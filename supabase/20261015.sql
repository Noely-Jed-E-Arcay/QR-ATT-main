-- QR Attendance System: incremental event/attendance security migration.
-- Review before running. This migration does not change existing records.
-- Uses the live role names: student, teacher, admin.

begin;

alter table public.events enable row level security;
alter table public.attendance enable row level security;

-- Add a minimal event lifecycle state. Existing events remain open by default.
alter table public.events
  add column if not exists status text not null default 'open';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.events'::regclass
      and conname = 'events_status_check'
  ) then
    alter table public.events
      add constraint events_status_check
      check (status in ('open', 'closed'));
  end if;
end;
$$;

-- Preserve one attendance row per student/event. Reuse an existing matching
-- unique index/constraint; create one only if the live schema lacks it.
do $$
begin
  if not exists (
    select 1
    from pg_index i
    where i.indrelid = 'public.attendance'::regclass
      and i.indisunique
      and i.indnkeyatts = 2
      and (
        select array_agg(a.attname::text order by a.attname::text)
        from unnest(i.indkey) with ordinality k(attnum, ord)
        join pg_attribute a
          on a.attrelid = i.indrelid and a.attnum = k.attnum
        where k.ord <= i.indnkeyatts
      ) = array['event_id', 'student_id']::text[]
  ) then
    if exists (
      select 1
      from public.attendance
      group by student_id, event_id
      having count(*) > 1
    ) then
      raise exception 'Duplicate attendance rows exist. Resolve duplicates before applying the attendance uniqueness index.';
    end if;

    create unique index if not exists attendance_student_event_unique_idx
      on public.attendance (student_id, event_id);
  end if;
end;
$$;

-- Trusted, server-side attendance eligibility check.
create or replace function public.can_register_attendance(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
    from public.events e
    join public.profiles p on p.id = (select auth.uid())
    where e.id = p_event_id
      and p.role = 'student'
      and e.status = 'open'
      and (e.start_time is null or now() >= e.start_time)
      and (e.end_time is null or now() <= e.end_time)
  );
$$;

revoke all on function public.can_register_attendance(uuid) from public, anon;
grant execute on function public.can_register_attendance(uuid) to authenticated;

-- Remove all known overlapping event policies from the live policy report.
drop policy if exists "Administrators can create events" on public.events;
drop policy if exists "Administrators can delete events" on public.events;
drop policy if exists "Administrators can update events" on public.events;
drop policy if exists "Administrators can view all events" on public.events;
drop policy if exists "Events are readable by any authenticated user" on public.events;
drop policy if exists "Students can view events" on public.events;
drop policy if exists "Teachers can create events" on public.events;
drop policy if exists "Teachers can delete their own events" on public.events;
drop policy if exists "Teachers can view their own events" on public.events;
drop policy if exists "Users can insert events" on public.events;
drop policy if exists "Users can update their own events" on public.events;

-- All signed-in users can browse events for the existing student QR workflow.
create policy "Authenticated users can view events"
on public.events
for select to authenticated
using (true);

-- Only a teacher or admin may create an event, and it must be owned by them.
create policy "Teachers and admins can create their own events"
on public.events
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (
    public.is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'teacher'
    )
  )
);

-- Teachers may update only their own events; admins may update any event.
create policy "Teachers can update their own events"
on public.events
for update to authenticated
using (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'teacher'
  )
)
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'teacher'
  )
);

create policy "Admins can update any event"
on public.events
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Teachers can delete their own events"
on public.events
for delete to authenticated
using (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'teacher'
  )
);

create policy "Admins can delete any event"
on public.events
for delete to authenticated
using (public.is_admin());

-- Replace attendance policies with role- and event-aware policies.
drop policy if exists "Administrators can manage attendance" on public.attendance;
drop policy if exists "Students can insert their own attendance" on public.attendance;
drop policy if exists "Students can view their own attendance" on public.attendance;
drop policy if exists "Teachers can view attendance for their events" on public.attendance;

create policy "Students can insert eligible attendance"
on public.attendance
for insert to authenticated
with check (
  student_id = (select auth.uid())
  and public.can_register_attendance(event_id)
);

create policy "Students can view their own attendance"
on public.attendance
for select to authenticated
using (student_id = (select auth.uid()));

create policy "Teachers can view attendance for their events"
on public.attendance
for select to authenticated
using (
  exists (
    select 1
    from public.events e
    join public.profiles p on p.id = (select auth.uid())
    where e.id = attendance.event_id
      and e.created_by = (select auth.uid())
      and p.role = 'teacher'
  )
);

create policy "Admins can manage attendance"
on public.attendance
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Harden the signup trigger function: all object references are qualified.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

-- Prevent anonymous direct invocation of privileged RPCs. Authenticated
-- clients still need these functions for the existing Admin approval UI.
revoke all on function public.approve_teacher_request(uuid) from public, anon;
revoke all on function public.reject_teacher_request(uuid) from public, anon;
grant execute on function public.approve_teacher_request(uuid) to authenticated, service_role;
grant execute on function public.reject_teacher_request(uuid) to authenticated, service_role;

commit;