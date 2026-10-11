import { parseQRPayload } from './qr';
import { getEventByCode } from './events';
import { supabase } from './supabase';

export async function registerAttendance(
  rawPayload: string,
  studentId: string
): Promise<RegisterResult> {
  const parsed = parseQRPayload(rawPayload);

  if (!parsed.ok) {
    return {
      success: false,
      message: parsed.message,
    };
  }

  const payload = parsed.payload;

  const now = Date.now();

  const start = payload.start
    ? new Date(payload.start).getTime()
    : null;

  const end = payload.end
    ? new Date(payload.end).getTime()
    : null;

  if (start && now < start) {
    return {
      success: false,
      message: 'Event has not started yet.',
    };
  }

  if (end && now > end) {
    return {
      success: false,
      message: 'Event has already ended.',
    };
  }

  const title = payload.title ?? payload.event;

  let event: {
    id: string;
    title: string;
  } | null = null;

  const foundEvent = await getEventByCode(
    payload.event
  );

  if (foundEvent) {
    event = foundEvent;
  } else {
    const {
      data: newEvent,
      error: insertError,
    } = await supabase
      .from('events')
      .insert([
        {
          event_code: payload.event,
          title,
          start_time: payload.start ?? null,
          end_time: payload.end ?? null,
        },
      ])
      .select('id, title')
      .single();

    if (insertError) {
      return {
        success: false,
        message: 'Could not create event.',
      };
    }

    event = newEvent;
  }

  const { error: attError } =
    await supabase
      .from('attendance')
      .insert([
        {
          student_id: studentId,
          event_id: event.id,
        },
      ]);

  if (attError) {
    if (attError.code === '23505') {
      return {
        success: false,
        message:
          'Already registered for this event.',
        eventTitle: event.title,
      };
    }

    return {
      success: false,
      message: attError.message,
    };
  }

  return {
    success: true,
    message: 'Attendance recorded!',
    eventTitle: event.title,
  };
}

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

export async function getAttendanceHistory(
  studentId: string
): Promise<AttendanceRecord[]> {
  const { data, error } =
    await supabase
      .from('attendance')
      .select(
        'id, scanned_at, events ( event_code, title )'
      )
      .eq('student_id', studentId)
      .order('scanned_at', {
        ascending: false,
      });

  if (error || !data) {
    return [];
  }

  return data.map((row: any) => ({
    id: row.id,
    eventId:
      row.events?.event_code ?? '',
    eventTitle:
      row.events?.title ??
      'Unknown event',
    scannedAt: row.scanned_at,
  }));
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
  // ----------------------------------------------------------
  // STEP 1: GET THE TEACHER'S EVENTS
  // ----------------------------------------------------------

  const {
    data: events,
    error: eventError,
  } = await supabase
    .from('events')
    .select(
      `
      id,
      event_code,
      title,
      location,
      start_time,
      end_time,
      created_at
      `
    )
    .eq('created_by', teacherId)
    .order('created_at', {
      ascending: false,
    });

  if (eventError) {
    console.log(
      'Error loading events:',
      eventError.message
    );

    return [];
  }

  if (!events || events.length === 0) {
    return [];
  }

  // ----------------------------------------------------------
  // STEP 2: GET ATTENDANCE
  // ----------------------------------------------------------

  const eventIds = events.map(
    (event: any) => event.id
  );

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
    .order('scanned_at', {
      ascending: false,
    });

  // IMPORTANT:
  // Do NOT return [] when attendance has an error.
  // We still want to display the events.

  if (attendanceError) {
    console.log(
      'Error loading attendance:',
      attendanceError.message
    );
  }

  const attendanceRows =
    attendance ?? [];

  // ----------------------------------------------------------
  // STEP 3: BUILD EVENT LIST
  // ----------------------------------------------------------

  return events.map((event: any) => {
    const rows =
      attendanceRows.filter(
        (attendance: any) =>
          attendance.event_id ===
          event.id
      );

    return {
      eventId: event.id,
      eventCode: event.event_code,
      title: event.title,
      location:
        event.location ?? null,
      startTime:
        event.start_time,
      endTime:
        event.end_time,
      attendeeCount:
        rows.length,

      attendees:
        rows.map(
          (attendance: any) => ({
            studentId:
              attendance.student_id,

            scannedAt:
              attendance.scanned_at,

            studentName:
              attendance.profiles
                ?.full_name ?? null,
          })
        ),
    };
  });
}

// ============================================================
// GET EVENT SUMMARIES
// ============================================================

export async function getTeacherEventSummary(
  teacherId: string
): Promise<TeacherEventSummary[]> {
  const {
    data: events,
    error: eventError,
  } = await supabase
    .from('events')
    .select(
      'id, event_code, title'
    )
    .eq('created_by', teacherId)
    .order('created_at', {
      ascending: false,
    });

  if (eventError || !events) {
    return [];
  }

  const eventIds = events.map(
    (event: any) => event.id
  );

  if (eventIds.length === 0) {
    return [];
  }

  const {
    data: attRows,
    error: attError,
  } = await supabase
    .from('attendance')
    .select('event_id')
    .in('event_id', eventIds);

  if (attError) {
    return events.map(
      (event: any) => ({
        eventId: event.id,
        eventCode: event.event_code,
        title: event.title,
        attendeeCount: 0,
      })
    );
  }

  const counts: Record<
    string,
    number
  > = {};

  (attRows ?? []).forEach(
    (row: any) => {
      counts[row.event_id] =
        (counts[row.event_id] ?? 0) +
        1;
    }
  );

  return events.map(
    (event: any) => ({
      eventId: event.id,
      eventCode: event.event_code,
      title: event.title,
      attendeeCount:
        counts[event.id] ?? 0,
    })
  );
}