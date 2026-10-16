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
  profiles:
    | { full_name: string | null; email: string }
    | { full_name: string | null; email: string }[]
    | null;
  events:
    | { title: string; event_code: string }
    | { title: string; event_code: string }[]
    | null;
};

type RawRoleRow = {
  role: string;
};

type RawAdminUser = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  created_at: string;
  updated_at: string;
};

function message(error: { message?: string } | null) {
  return error?.message ?? 'An unexpected database error occurred.';
}

/**
 * Convert database roles into the application's role format.
 * The database may use "administrator", while the app uses "admin".
 */
function normalizeRole(value: string): Role | null {
  if (value === 'student' || value === 'teacher') {
    return value;
  }

  if (value === 'admin' || value === 'administrator') {
    return 'admin';
  }

  return null;
}

/**
 * Convert the application role into the database role.
 *
 * This assumes your profiles_role_check constraint accepts
 * "administrator" rather than "admin".
 */
function toDatabaseRole(
  role: AdminUser['role'],
): string {
  return role === 'admin' ? 'admin' : role;
}

/**
 * Extract related records returned by Supabase.
 * Relationships may be represented as an object or an array.
 */
function firstRelation<T>(
  value: T | T[] | null | undefined
): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

/**
 * Convert a Supabase attendance row into the format
 * used by the administrator screens.
 */
function mapAttendance(row: RawAttendanceRow): AdminAttendance {
  const profile = firstRelation(row.profiles);
  const event = firstRelation(row.events);

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
}

/**
 * Validate an event's required information and schedule.
 */
function validateEvent(input: {
  event_code: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
}): string | null {
  if (!input.event_code.trim()) {
    return 'Event code is required.';
  }

  if (!input.title.trim()) {
    return 'Event title is required.';
  }

  if (input.event_code.trim().length > 50) {
    return 'Event code cannot exceed 50 characters.';
  }

  if (input.title.trim().length > 150) {
    return 'Event title cannot exceed 150 characters.';
  }

  if (input.start_time && !Number.isFinite(Date.parse(input.start_time))) {
    return 'Please provide a valid event start time.';
  }

  if (input.end_time && !Number.isFinite(Date.parse(input.end_time))) {
    return 'Please provide a valid event end time.';
  }

  if (input.start_time && input.end_time) {
    if (Date.parse(input.end_time) <= Date.parse(input.start_time)) {
      return 'The event end time must be after the start time.';
    }
  }

  return null;
}

/**
 * Retrieve all users for administrator user management.
 */
export async function getAdminUsers(): Promise<{
  data: AdminUser[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (error) {
    return { data: [], error: message(error) };
  }

  if (!data) {
    return { data: [], error: null };
  }

  const rows = data as unknown as RawAdminUser[];
  const users: AdminUser[] = [];

  for (const row of rows) {
    const role = normalizeRole(row.role);

    if (!role) {
      console.warn('Skipping a profile with an unrecognized role.');
      continue;
    }

    users.push({
      id: row.id,
      email: row.email,
      full_name: row.full_name,
      role,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }

  return { data: users, error: null };
}

/**
 * Update a user's name and role.
 * Administrators cannot edit their own account through this function.
 */
export async function updateAdminUser(
  userId: string,
  updates: { full_name: string; role: Role }
): Promise<{ error: string | null }> {
  if (!userId.trim()) {
    return { error: 'A valid user ID is required.' };
  }

  const fullName = updates.full_name.trim();

  if (!fullName) {
    return { error: 'Full name is required.' };
  }

  if (fullName.length > 150) {
    return { error: 'Full name cannot exceed 150 characters.' };
  }

  const { data: authData, error: authError } =
    await supabase.auth.getUser();

  if (authError || !authData.user) {
    return { error: 'You must be signed in to manage users.' };
  }

  if (authData.user.id === userId) {
    return {
      error: 'You cannot modify your own administrator account here.',
    };
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: fullName,
      role: toDatabaseRole(updates.role),
    })
    .eq('id', userId);

  return { error: error ? message(error) : null };
}

/**
 * Retrieve all events.
 */
export async function getAdminEvents(): Promise<{
  data: AdminEvent[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('events')
    .select(
      'id, event_code, title, start_time, end_time, created_by, created_at'
    )
    .order('created_at', { ascending: false });

  if (error) {
    return { data: [], error: message(error) };
  }

  return {
    data: (data ?? []) as AdminEvent[],
    error: null,
  };
}

/**
 * Create an event under the currently signed-in account.
 */
export async function createAdminEvent(input: {
  event_code: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
}): Promise<{ error: string | null }> {
  const validationError = validateEvent(input);

  if (validationError) {
    return { error: validationError };
  }

  const { data: authData, error: authError } =
    await supabase.auth.getUser();

  if (authError || !authData.user) {
    return { error: 'You are not signed in.' };
  }

  const { error } = await supabase.from('events').insert({
    event_code: input.event_code.trim().toUpperCase(),
    title: input.title.trim(),
    start_time: input.start_time,
    end_time: input.end_time,
    created_by: authData.user.id,
  });

  return { error: error ? message(error) : null };
}

/**
 * Update an existing event.
 */
export async function updateAdminEvent(
  eventId: string,
  updates: {
    event_code: string;
    title: string;
    start_time: string | null;
    end_time: string | null;
  }
): Promise<{ error: string | null }> {
  if (!eventId.trim()) {
    return { error: 'A valid event ID is required.' };
  }

  const validationError = validateEvent(updates);

  if (validationError) {
    return { error: validationError };
  }

  const { error } = await supabase
    .from('events')
    .update({
      event_code: updates.event_code.trim().toUpperCase(),
      title: updates.title.trim(),
      start_time: updates.start_time,
      end_time: updates.end_time,
    })
    .eq('id', eventId);

  return { error: error ? message(error) : null };
}

/**
 * Delete an event.
 */
export async function deleteAdminEvent(
  eventId: string
): Promise<{ error: string | null }> {
  if (!eventId.trim()) {
    return { error: 'A valid event ID is required.' };
  }

  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId);

  return { error: error ? message(error) : null };
}

/**
 * Retrieve attendance records with their related student and event.
 */
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

  if (error) {
    return { data: [], error: message(error) };
  }

  const rows = (data ?? []) as unknown as RawAttendanceRow[];

  return {
    data: rows.map(mapAttendance),
    error: null,
  };
}

/**
 * Update an attendance record's scan timestamp.
 */
export async function updateAttendanceRecord(
  attendanceId: string,
  scannedAt: string
): Promise<{ error: string | null }> {
  if (!attendanceId.trim()) {
    return { error: 'A valid attendance ID is required.' };
  }

  if (!scannedAt.trim() || !Number.isFinite(Date.parse(scannedAt))) {
    return { error: 'Please provide a valid attendance date and time.' };
  }

  const { error } = await supabase
    .from('attendance')
    .update({ scanned_at: scannedAt })
    .eq('id', attendanceId);

  return { error: error ? message(error) : null };
}

/**
 * Delete an attendance record.
 */
export async function deleteAttendanceRecord(
  attendanceId: string
): Promise<{ error: string | null }> {
  if (!attendanceId.trim()) {
    return { error: 'A valid attendance ID is required.' };
  }

  const { error } = await supabase
    .from('attendance')
    .delete()
    .eq('id', attendanceId);

  return { error: error ? message(error) : null };
}

/**
 * Retrieve summary counts and the latest attendance records.
 */
export async function getAdminDashboard(): Promise<{
  data: AdminDashboard | null;
  error: string | null;
}> {
  const [
    usersResult,
    eventsResult,
    attendanceResult,
    recentResult,
  ] = await Promise.all([
    supabase.from('profiles').select('role'),

    supabase
      .from('events')
      .select('id', { count: 'exact', head: true }),

    supabase
      .from('attendance')
      .select('id', { count: 'exact', head: true }),

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

  const studentCount = users.filter(
    (user) => user.role === 'student'
  ).length;

  const teacherCount = users.filter(
    (user) => user.role === 'teacher'
  ).length;

  const administratorCount = users.filter(
    (user) => user.role === 'admin' || user.role === 'administrator'
  ).length;

  const recentAttendance = recentRows.map(mapAttendance);

  return {
    data: {
      userCount: users.length,
      studentCount,
      teacherCount,
      administratorCount,
      eventCount: eventsResult.count ?? 0,
      attendanceCount: attendanceResult.count ?? 0,
      recentAttendance,
    },
    error: null,
  };
}