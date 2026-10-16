
import { parseQRPayload } from './qr';
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

type EventForAttendance = {
  id: string;
  event_code: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
  status: string;
};

function isValidDate(value: string | null): number | null {
  if (!value) return null;

  const timestamp = new Date(value).getTime();

  return Number.isFinite(timestamp) ? timestamp : null;
}

/**
 * Fixing: validate attendance against the current database event.
 * QR payload dates alone are not authoritative.
 */
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

    const parsed = parseQRPayload(rawPayload);

    if (!parsed.ok) {
      return {
        success: false,
        message: parsed.message,
      };
    }

    const payload = parsed.payload;
    const eventCode = payload.event.trim().toUpperCase();

    if (!eventCode) {
      return {
        success: false,
        message: 'The QR code does not contain a valid event code.',
      };
    }

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

    // Look up the event's current database status and schedule.
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .select(
        'id, event_code, title, start_time, end_time, status'
      )
      .eq('event_code', eventCode)
      .maybeSingle();

    if (eventError) {
      console.error('Event lookup failed:', eventError.message);

      return {
        success: false,
        message: 'Could not verify the event. Please try again.',
      };
    }

    if (!eventData) {
      return {
        success: false,
        message: 'Event not found. Please scan a valid event QR code.',
      };
    }

    const event = eventData as EventForAttendance;
    const eventTitle = event.title;

    // Closed status takes priority over schedule validation.
    if (event.status !== 'open') {
      return {
        success: false,
        message: 'This event is closed. Attendance registration is no longer available.',
        eventTitle,
      };
    }

    const now = Date.now();

    // Use the database schedule as the source of truth.
    const start = isValidDate(event.start_time);
    const end = isValidDate(event.end_time);

    if (event.start_time && start === null) {
      return {
        success: false,
        message: 'The event has an invalid start time. Please contact the administrator.',
        eventTitle,
      };
    }

    if (event.end_time && end === null) {
      return {
        success: false,
        message: 'The event has an invalid end time. Please contact the administrator.',
        eventTitle,
      };
    }

    if (start !== null && now < start) {
      return {
        success: false,
        message: 'Event has not started yet.',
        eventTitle,
      };
    }

    if (end !== null && now > end) {
      return {
        success: false,
        message: 'Event has already ended.',
        eventTitle,
      };
    }

    // Retain QR schedule validation when the QR includes dates.
    const qrStart = payload.start
      ? new Date(payload.start).getTime()
      : null;

    const qrEnd = payload.end
      ? new Date(payload.end).getTime()
      : null;

    if (qrStart !== null && !Number.isFinite(qrStart)) {
      return {
        success: false,
        message: 'Invalid event start time in QR code.',
        eventTitle,
      };
    }

    if (qrEnd !== null && !Number.isFinite(qrEnd)) {
      return {
        success: false,
        message: 'Invalid event end time in QR code.',
        eventTitle,
      };
    }

    if (qrStart !== null && now < qrStart) {
      return {
        success: false,
        message: 'Event has not started yet.',
        eventTitle,
      };
    }

    if (qrEnd !== null && now > qrEnd) {
      return {
        success: false,
        message: 'Event has already ended.',
        eventTitle,
      };
    }

    // Register attendance using the database event ID.
    const { error: attendanceError } = await supabase
      .from('attendance')
      .insert({
        student_id: studentId,
        event_id: event.id,
      });

    if (attendanceError) {
      if (attendanceError.code === '23505') {
        return {
          success: false,
          message: 'Already registered for this event.',
          eventTitle,
        };
      }

      if (
        attendanceError.code === 'P0001' ||
        attendanceError.message.toLowerCase().includes('event is closed')
      ) {
        return {
          success: false,
          message: 'This event is closed. Attendance registration is no longer available.',
          eventTitle,
        };
      }

      console.error(
        'Attendance registration failed:',
        attendanceError
      );

      return {
        success: false,
        message: 'Could not record attendance. Please try again.',
        eventTitle,
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

    return data.map((row: any) => {
      const event = Array.isArray(row.events)
        ? row.events[0]
        : row.events;

      return {
        id: row.id,
        eventId: event?.event_code ?? '',
        eventTitle: event?.title ?? 'Unknown event',
        scannedAt: row.scanned_at,
      };
    });
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
    if (!teacherId) {
      return [];
    }

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

    if (!events?.length) {
      return [];
    }

    const eventIds = events.map((event) => event.id);

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

      return events.map((event) => ({
        eventId: event.id,
        eventCode: event.event_code,
        title: event.title,
        location: event.location ?? null,
        startTime: event.start_time,
        endTime: event.end_time,
        attendeeCount: 0,
        attendees: [],
      }));
    }

    const attendanceRows = attendance ?? [];

    return events.map((event) => {
      const rows = attendanceRows.filter(
        (row) => row.event_id === event.id
      );

      return {
        eventId: event.id,
        eventCode: event.event_code,
        title: event.title,
        location: event.location ?? null,
        startTime: event.start_time,
        endTime: event.end_time,
        attendeeCount: rows.length,
        attendees: rows.map((row: any) => {
          const profile = Array.isArray(row.profiles)
            ? row.profiles[0]
            : row.profiles;

          return {
            studentId: row.student_id,
            scannedAt: row.scanned_at,
            studentName: profile?.full_name ?? null,
          };
        }),
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
    if (!teacherId) {
      return [];
    }

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

    if (!events.length) {
      return [];
    }

    const eventIds = events.map((event) => event.id);

    const {
      data: attendanceRows,
      error: attendanceError,
    } = await supabase
      .from('attendance')
      .select('event_id')
      .in('event_id', eventIds);

    if (attendanceError) {
      console.error(
        'Error loading attendance summaries:',
        attendanceError.message
      );

      return events.map((event) => ({
        eventId: event.id,
        eventCode: event.event_code,
        title: event.title,
        attendeeCount: 0,
      }));
    }

    const counts: Record<string, number> = {};

    (attendanceRows ?? []).forEach((row) => {
      counts[row.event_id] = (counts[row.event_id] ?? 0) + 1;
    });

    return events.map((event) => ({
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
