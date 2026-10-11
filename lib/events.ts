import { supabase } from './supabase';

export type Event = {
  eventId: string;
  title: string;
  start: string;
  end: string;
  location: string;
};

export type CloudEvent = {
  id: string;
  event_code: string;
  title: string;
  location: string | null;
  start_time: string | null;
  end_time: string | null;
  created_by: string | null;
  created_at: string;
};

// ============================================================
// CREATE EVENT
// ============================================================

export async function createEvent(
  event: Event
): Promise<{ error: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: 'You must be logged in to create an event.',
    };
  }

  const { error } = await supabase
    .from('events')
    .insert({
      event_code: event.eventId,
      title: event.title,
      location: event.location || null,
      start_time: event.start || null,
      end_time: event.end || null,
      created_by: user.id,
    });

  return {
    error: error?.message ?? null,
  };
}

// ============================================================
// GET EVENTS CREATED BY TEACHER
// ============================================================

export async function getEventsByTeacher(
  teacherId: string
): Promise<CloudEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select(
      'id, event_code, title, location, start_time, end_time, created_by, created_at'
    )
    .eq('created_by', teacherId)
    .order('created_at', {
      ascending: false,
    });

  if (error || !data) {
    return [];
  }

  return data as CloudEvent[];
}

// ============================================================
// GET EVENT BY CODE
// ============================================================

export async function getEventByCode(
  code: string
): Promise<CloudEvent | null> {
  const { data, error } = await supabase
    .from('events')
    .select(
      'id, event_code, title, location, start_time, end_time, created_by, created_at'
    )
    .eq('event_code', code)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as CloudEvent;
}

// ============================================================
// UPDATE EVENT
// ============================================================

export async function updateEvent(
  eventId: string,
  updates: {
    title: string;
    start: string;
    end: string;
    location: string;
  }
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('events')
    .update({
      title: updates.title,
      location: updates.location || null,
      start_time: updates.start || null,
      end_time: updates.end || null,
    })
    .eq('id', eventId);

  return {
    error: error?.message ?? null,
  };
}

// ============================================================
// DELETE EVENT
// ============================================================

export async function deleteEvent(
  eventId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId);

  return {
    error: error?.message ?? null,
  };
}