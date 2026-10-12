
import { parseQRPayload } from './qr';
import { getEventByCode } from './events';
import { supabase } from './supabase';

export type RegisterResult = {
  success: boolean;
  message: string;
  eventTitle?: string;
};

export type AttendanceRecord = {
  id: string;
  eventId: string;
  eventTitle: string;
  scannedAt: string;
};

export async function registerAttendance(
  rawPayload: string,
  studentId: string
): Promise<RegisterResult> {
  try {
    if (!studentId) {
      return {
        success: false,
        message: 'You must be signed in to register attendance.',
      };
    }

    // Validate the QR code.
    const parsed = parseQRPayload(rawPayload);

    if (!parsed.ok) {
      return {
        success: false,
        message: parsed.message,
      };
    }

    const payload = parsed.payload;

    // Validate the event schedule, if provided in the QR code.
    const now = Date.now();

    const start = payload.start
      ? new Date(payload.start).getTime()
      : null;

    const end = payload.end
      ? new Date(payload.end).getTime()
      : null;

    if (start !== null && !Number.isFinite(start)) {
      return {
        success: false,
        message: 'Invalid event start time in QR code.',
      };
    }

    if (end !== null && !Number.isFinite(end)) {
      return {
        success: false,
        message: 'Invalid event end time in QR code.',
      };
    }

    if (start !== null && now < start) {
      return {
        success: false,
        message: 'Event has not started yet.',
      };
    }

    if (end !== null && now > end) {
      return {
        success: false,
        message: 'Event has already ended.',
      };
    }

    // Find the existing event using its event code.
    const {
      event: foundEvent,
      error: lookupError,
    } = await getEventByCode(payload.event);

    if (lookupError || !foundEvent) {
      return {
        success: false,
        message:
          lookupError === 'Event not found.'
            ? 'Event not found. Please scan a valid event QR code.'
            : lookupError ?? 'Could not find the event.',
      };
    }

    // Use the database event ID, not the QR event code.
    const eventId = foundEvent.id;
    const eventTitle = foundEvent.title;

    if (!eventId) {
      return {
        success: false,
        message: 'The event has no valid database ID.',
      };
    }

    // Confirm that the signed-in student matches the supplied ID.
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user || user.id !== studentId) {
      return {
        success: false,
        message: 'Your session is invalid. Please sign in again.',
      };
    }

    // Record attendance for the existing event.
    const { error: attendanceError } = await supabase
      .from('attendance')
      .insert({
        student_id: studentId,
        event_id: eventId,
      });

    if (attendanceError) {
      if (attendanceError.code === '23505') {
        return {
          success: false,
          message: 'Already registered for this event.',
          eventTitle,
        };
      }

      console.error(
        'Attendance registration failed:',
        attendanceError
      );

      return {
        success: false,
        message: attendanceError.message,
      };
    }

    return {
      success: true,
      message: 'Attendance recorded!',
      eventTitle,
    };
  } catch (error) {
    console.error('registerAttendance failed:', error);

    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred while registering attendance.',
    };
  }
}

// ============================================================
// STUDENT ATTENDANCE HISTORY
// ============================================================

export async function getAttendanceHistory(
  studentId: string
): Promise<AttendanceRecord[]> {
  try {
    if (!studentId) {
      return [];
    }

    const { data, error } = await supabase
      .from('attendance')
      .select('id, scanned_at, events ( event_code, title )')
      .eq('student_id', studentId)
      .order('scanned_at', { ascending: false });

    if (error || !data) {
      console.error(
        'Failed to load attendance history:',
        error?.message
      );
      return [];
    }

    return data.map((row: any) => ({
      id: row.id,
      eventId: row.events?.event_code ?? '',
      eventTitle: row.events?.title ?? 'Unknown event',
      scannedAt: row.scanned_at,
    }));
  } catch (error) {
    console.error('getAttendanceHistory failed:', error);
    return [];
  }
}

// ============================================================
// TEACHER / ADMIN EVENT ATTENDANCE
// ============================================================

export type TeacherEventAttendance = {
  location: string | null;
  eventId: string;
  eventCode: string;
  title: string;
  startTime: string | null;
  endTime: string | null;
  attendeeCount: number;
  attendees: {
    studentId: string;
    scannedAt: string;
    studentName: string | null;
  }[];
};

export type TeacherEventSummary = {
  eventId: string;
  eventCode: string;
  title: string;
  attendeeCount: number;
};

// ============================================================
// GET EVENTS CREATED BY TEACHER
// ============================================================

export async function getTeacherEventAttendance(
  teacherId: string
): Promise<TeacherEventAttendance[]> {
  try {
    const { data: events, error: eventError } = await supabase
      .from('events')
      .select(`
        id,
        event_code,
        title,
        location,
        start_time,
        end_time,
        created_at
      `)
      .eq('created_by', teacherId)
      .order('created_at', { ascending: false });

    if (eventError) {
      console.error(
        'Error loading events:',
        eventError.message
      );
      return [];
    }

    if (!events || events.length === 0) {
      return [];
    }

    const eventIds = events.map((event: any) => event.id);

    const {
      data: attendance,
      error: attendanceError,
    } = await supabase
      .from('attendance')
      .select(`
        student_id,
        scanned_at,
        event_id,
        profiles (
          full_name,
          email
        )
      `)
      .in('event_id', eventIds)
      .order('scanned_at', { ascending: false });

    if (attendanceError) {
      console.error(
        'Error loading attendance:',
        attendanceError.message
      );
    }

    const attendanceRows = attendance ?? [];

    return events.map((event: any) => {
      const rows = attendanceRows.filter(
        (row: any) => row.event_id === event.id
      );

      return {
        eventId: event.id,
        eventCode: event.event_code,
        title: event.title,
        location: event.location ?? null,
        startTime: event.start_time,
        endTime: event.end_time,
        attendeeCount: rows.length,
        attendees: rows.map((row: any) => ({
          studentId: row.student_id,
          scannedAt: row.scanned_at,
          studentName: row.profiles?.full_name ?? null,
        })),
      };
    });
  } catch (error) {
    console.error('getTeacherEventAttendance failed:', error);
    return [];
  }
}

// ============================================================
// GET EVENT SUMMARIES
// ============================================================

export async function getTeacherEventSummary(
  teacherId: string
): Promise<TeacherEventSummary[]> {
  try {
    const { data: events, error: eventError } = await supabase
      .from('events')
      .select('id, event_code, title, created_at')
      .eq('created_by', teacherId)
      .order('created_at', { ascending: false });

    if (eventError || !events) {
      console.error(
        'Error loading event summaries:',
        eventError?.message
      );
      return [];
    }

    if (events.length === 0) {
      return [];
    }

    const eventIds = events.map((event: any) => event.id);

    const { data: attendanceRows, error: attendanceError } =
      await supabase
        .from('attendance')
        .select('event_id')
        .in('event_id', eventIds);

    if (attendanceError) {
      console.error(
        'Error loading attendance summaries:',
        attendanceError.message
      );

      return events.map((event: any) => ({
        eventId: event.id,
        eventCode: event.event_code,
        title: event.title,
        attendeeCount: 0,
      }));
    }

    const counts: Record<string, number> = {};

    (attendanceRows ?? []).forEach((row: any) => {
      counts[row.event_id] = (counts[row.event_id] ?? 0) + 1;
    });

    return events.map((event: any) => ({
      eventId: event.id,
      eventCode: event.event_code,
      title: event.title,
      attendeeCount: counts[event.id] ?? 0,
    }));
  } catch (error) {
    console.error('getTeacherEventSummary failed:', error);
    return [];
  }
}
