import { supabase } from './supabase';
import type { Role } from './profiles';

export type AdminUser = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  created_at: string;
  updated_at: string;
};

export type AdminEvent = {
  id: string;
  event_code: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
  created_by: string;
  created_at: string;
};

export type AdminAttendance = {
  id: string;
  student_id: string;
  event_id: string;
  scanned_at: string;
  student_name: string | null;
  student_email: string | null;
  event_title: string;
  event_code: string;
};

export type AdminDashboard = {
  userCount: number;
  studentCount: number;
  teacherCount: number;
  administratorCount: number;
  eventCount: number;
  attendanceCount: number;
  recentAttendance: AdminAttendance[];
};

type RawAttendanceRow = {
  id: string;
  student_id: string;
  event_id: string;
  scanned_at: string;
  profiles: { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null;
  events: { title: string; event_code: string } | { title: string; event_code: string }[] | null;
};

type RawRoleRow = {
  role: Role;
};

function message(error: { message?: string } | null) {
  return error?.message ?? 'An unexpected database error occurred.';
}

export async function getAdminUsers(): Promise<{
  data: AdminUser[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (error || !data) {
    return { data: [], error: message(error) };
  }

  return { data: data as AdminUser[], error: null };
}

export async function updateAdminUser(
  userId: string,
  updates: { full_name: string; role: Role }
): Promise<{ error: string | null }> {
  const { data: currentUser } = await supabase.auth.getUser();

  if (currentUser.user?.id === userId) {
    return { error: 'You cannot modify your own administrator account here.' };
  }

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);

  return { error: error ? message(error) : null };
}

export async function getAdminEvents(): Promise<{
  data: AdminEvent[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('events')
    .select('id, event_code, title, start_time, end_time, created_by, created_at')
    .order('created_at', { ascending: false });

  if (error || !data) {
    return { data: [], error: message(error) };
  }

  return { data: data as AdminEvent[], error: null };
}

export async function createAdminEvent(input: {
  event_code: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
}): Promise<{ error: string | null }> {
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return { error: 'You are not signed in.' };
  }

  const { error } = await supabase.from('events').insert({
    event_code: input.event_code,
    title: input.title,
    start_time: input.start_time,
    end_time: input.end_time,
    created_by: authData.user.id,
  });

  return { error: error ? message(error) : null };
}

export async function updateAdminEvent(
  eventId: string,
  updates: {
    event_code: string;
    title: string;
    start_time: string | null;
    end_time: string | null;
  }
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('events')
    .update(updates)
    .eq('id', eventId);

  return { error: error ? message(error) : null };
}

export async function deleteAdminEvent(
  eventId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('events').delete().eq('id', eventId);
  return { error: error ? message(error) : null };
}

export async function getAdminAttendance(): Promise<{
  data: AdminAttendance[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('attendance')
    .select(`
      id,
      student_id,
      event_id,
      scanned_at,
      profiles ( full_name, email ),
      events ( title, event_code )
    `)
    .order('scanned_at', { ascending: false });

  if (error || !data) {
    return { data: [], error: message(error) };
  }

  const rows: AdminAttendance[] = (data as unknown as RawAttendanceRow[]).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    const event = Array.isArray(row.events) ? row.events[0] : row.events;

    return {
      id: row.id,
      student_id: row.student_id,
      event_id: row.event_id,
      scanned_at: row.scanned_at,
      student_name: profile?.full_name ?? null,
      student_email: profile?.email ?? null,
      event_title: event?.title ?? 'Unknown event',
      event_code: event?.event_code ?? '',
    };
  });

  return { data: rows, error: null };
}

export async function updateAttendanceRecord(
  attendanceId: string,
  scannedAt: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('attendance')
    .update({ scanned_at: scannedAt })
    .eq('id', attendanceId);

  return { error: error ? message(error) : null };
}

export async function deleteAttendanceRecord(
  attendanceId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('attendance')
    .delete()
    .eq('id', attendanceId);

  return { error: error ? message(error) : null };
}

export async function getAdminDashboard(): Promise<{
  data: AdminDashboard | null;
  error: string | null;
}> {
  const [usersResult, eventsResult, attendanceResult, recentResult] =
    await Promise.all([
      supabase.from('profiles').select('role'),
      supabase.from('events').select('id', { count: 'exact', head: true }),
      supabase.from('attendance').select('id', { count: 'exact', head: true }),
      supabase
        .from('attendance')
        .select(`
          id,
          student_id,
          event_id,
          scanned_at,
          profiles ( full_name, email ),
          events ( title, event_code )
        `)
        .order('scanned_at', { ascending: false })
        .limit(8),
    ]);

  if (usersResult.error) {
    return { data: null, error: message(usersResult.error) };
  }
  if (eventsResult.error) {
    return { data: null, error: message(eventsResult.error) };
  }
  if (attendanceResult.error) {
    return { data: null, error: message(attendanceResult.error) };
  }
  if (recentResult.error) {
    return { data: null, error: message(recentResult.error) };
  }

  const users = (usersResult.data ?? []) as unknown as RawRoleRow[];
  const recentRows = (recentResult.data ?? []) as unknown as RawAttendanceRow[];

  const recentAttendance: AdminAttendance[] = recentRows.map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    const event = Array.isArray(row.events) ? row.events[0] : row.events;

    return {
      id: row.id,
      student_id: row.student_id,
      event_id: row.event_id,
      scanned_at: row.scanned_at,
      student_name: profile?.full_name ?? null,
      student_email: profile?.email ?? null,
      event_title: event?.title ?? 'Unknown event',
      event_code: event?.event_code ?? '',
    };
  });

  return {
    data: {
      userCount: users.length,
      studentCount: users.filter((user) => user.role === 'student').length,
      teacherCount: users.filter((user) => user.role === 'teacher').length,
      administratorCount: users.filter((user) => user.role === 'admin').length,
      eventCount: eventsResult.count ?? 0,
      attendanceCount: attendanceResult.count ?? 0,
      recentAttendance,
    },
    error: null,
  };
}
