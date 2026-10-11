-- ============================================================
-- QR-ATT SUPABASE SCHEMA
-- Existing tables are reused. Administrator access is added through
-- the existing profiles, events, and attendance tables.
-- ============================================================

-- ============================================================
-- ADMIN ROLE HELPER
-- ============================================================

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'administrator'
  );
$$;


-- ============================================================
-- PROFILES
-- ============================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'student',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

alter table public.profiles
drop constraint if exists profiles_role_check;

alter table public.profiles
add constraint profiles_role_check
check (role in ('student', 'teacher', 'administrator'));


drop policy if exists "Users can view their own profile"
on public.profiles;

create policy "Users can view their own profile"
on public.profiles
for select
using (
  id = auth.uid()
  or public.is_admin()
);


drop policy if exists "Users can insert their own profile"
on public.profiles;

create policy "Users can insert their own profile"
on public.profiles
for insert
with check (
  id = auth.uid()
);


drop policy if exists "Users can update their own profile"
on public.profiles;

create policy "Users can update their own profile"
on public.profiles
for update
using (
  id = auth.uid()
  or (public.is_admin() and id <> auth.uid())
)
with check (
  id = auth.uid()
  or (public.is_admin() and id <> auth.uid())
);


drop policy if exists "Teachers can view profiles of their attendees"
on public.profiles;

create policy "Teachers can view profiles of their attendees"
on public.profiles
for select
using (
  exists (
    select 1
    from public.attendance a
    join public.events e
      on e.id = a.event_id
    where a.student_id = profiles.id
      and e.created_by = auth.uid()
  )
);


-- ============================================================
-- EVENTS
-- ============================================================

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  event_code text not null unique,
  title text not null,
  start_time timestamptz,
  end_time timestamptz,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.events enable row level security;


drop policy if exists "Teachers can create events"
on public.events;

create policy "Teachers can create events"
on public.events
for insert
with check (
  created_by = auth.uid()
);


drop policy if exists "Teachers can view their own events"
on public.events;

create policy "Teachers can view their own events"
on public.events
for select
using (
  created_by = auth.uid()
);


drop policy if exists "Students can view events"
on public.events;

create policy "Students can view events"
on public.events
for select
using (true);


drop policy if exists "Administrators can view all events"
on public.events;

create policy "Administrators can view all events"
on public.events
for select
using (public.is_admin());


drop policy if exists "Administrators can create events"
on public.events;

create policy "Administrators can create events"
on public.events
for insert
with check (
  public.is_admin()
  and created_by = auth.uid()
);


drop policy if exists "Administrators can update events"
on public.events;

create policy "Administrators can update events"
on public.events
for update
using (public.is_admin())
with check (public.is_admin());


drop policy if exists "Administrators can delete events"
on public.events;

create policy "Administrators can delete events"
on public.events
for delete
using (public.is_admin());


-- ============================================================
-- ATTENDANCE
-- ============================================================

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null,
  event_id uuid not null
    references public.events(id)
    on delete cascade,
  scanned_at timestamptz not null default now(),
  unique (student_id, event_id)
);

alter table public.attendance enable row level security;


alter table public.attendance
drop constraint if exists attendance_student_id_fkey;

alter table public.attendance
add constraint attendance_student_id_fkey
foreign key (student_id)
references public.profiles(id)
on delete cascade;


drop policy if exists "Students can insert their own attendance"
on public.attendance;

create policy "Students can insert their own attendance"
on public.attendance
for insert
with check (
  student_id = auth.uid()
);


drop policy if exists "Students can view their own attendance"
on public.attendance;

create policy "Students can view their own attendance"
on public.attendance
for select
using (
  student_id = auth.uid()
);


drop policy if exists "Teachers can view attendance for their events"
on public.attendance;

create policy "Teachers can view attendance for their events"
on public.attendance
for select
using (
  exists (
    select 1
    from public.events e
    where e.id = attendance.event_id
      and e.created_by = auth.uid()
  )
);


drop policy if exists "Administrators can manage attendance"
on public.attendance;

create policy "Administrators can manage attendance"
on public.attendance
for all
using (public.is_admin())
with check (public.is_admin());
