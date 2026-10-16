
import { supabase } from './supabase';

export type Event = {
  eventId: string;
  title: string;
  location?: string;
  description?: string;
  start: string;
  end: string;
};

export type EventStatus = 'open' | 'closed';

export type CloudEvent = {
  id: string;
  event_code: string;
  title: string;
  location: string | null;
  description: string | null;
  start_time: string | null;
  end_time: string | null;
  created_by: string | null;
  created_at: string;
  status: EventStatus;
};

function normalizeEventStatus(value: unknown): EventStatus {
  return value === 'closed' ? 'closed' : 'open';
}

function normalizeCloudEvent(row: any): CloudEvent {
  return {
    id: row.id,
    event_code: row.event_code,
    title: row.title,
    location: row.location ?? null,
    description: row.description ?? null,
    start_time: row.start_time ?? null,
    end_time: row.end_time ?? null,
    created_by: row.created_by ?? null,
    created_at: row.created_at,
    status: normalizeEventStatus(row.status),
  };
}

/**
 * Create a new event.
 * New events start open using the existing status column.
 */
export async function createEvent(
  event: Omit<
    CloudEvent,
    'id' | 'created_at' | 'created_by' | 'status'
  >,
): Promise<{ event: CloudEvent | null; error: string | null }> {
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        event: null,
        error: 'You must be signed in to create an event.',
      };
    }

    const { data, error } = await supabase
      .from('events')
      .insert({
        event_code: event.event_code.trim().toUpperCase(),
        title: event.title.trim(),
        location: event.location?.trim() || null,
        description: event.description?.trim() || null,
        start_time: event.start_time,
        end_time: event.end_time,
        created_by: user.id,
        status: 'open',
      })
      .select('*')
      .single();

    if (error) {
      console.error('createEvent error:', error.message);
      return { event: null, error: error.message };
    }

    return {
      event: normalizeCloudEvent(data),
      error: null,
    };
  } catch (error) {
    console.error('createEvent exception:', error);

    return {
      event: null,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to create event.',
    };
  }
}

/**
 * Get all events visible to the signed-in user.
 * Events are ordered by start time, latest first.
 * Closed events remain available for status/history display.
 */
export async function getAvailableEvents(): Promise<{
  events: CloudEvent[];
  error: string | null;
}> {
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        events: [],
        error: 'You must be signed in to view school events.',
      };
    }

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('start_time', {
        ascending: false,
        nullsFirst: false,
      });

    if (error) {
      console.error('getAvailableEvents error:', error.message);
      return { events: [], error: error.message };
    }

    return {
      events: (data ?? []).map(normalizeCloudEvent),
      error: null,
    };
  } catch (error) {
    console.error('getAvailableEvents exception:', error);

    return {
      events: [],
      error:
        error instanceof Error
          ? error.message
          : 'Failed to load school events.',
    };
  }
}

/**
 * Get events created by the currently signed-in user.
 */
export async function getEventsByTeacher(): Promise<{
  events: CloudEvent[];
  error: string | null;
}> {
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        events: [],
        error: 'You must be signed in to view your events.',
      };
    }

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('getEventsByTeacher error:', error.message);
      return { events: [], error: error.message };
    }

    return {
      events: (data ?? []).map(normalizeCloudEvent),
      error: null,
    };
  } catch (error) {
    console.error('getEventsByTeacher exception:', error);

    return {
      events: [],
      error:
        error instanceof Error
          ? error.message
          : 'Failed to load your events.',
    };
  }
}

/**
 * Find one event by its event code.
 */
export async function getEventByCode(
  eventCode: string,
): Promise<{ event: CloudEvent | null; error: string | null }> {
  try {
    const normalizedCode = eventCode.trim().toUpperCase();

    if (!normalizedCode) {
      return {
        event: null,
        error: 'Please enter an event code.',
      };
    }

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('event_code', normalizedCode)
      .maybeSingle();

    if (error) {
      console.error('getEventByCode error:', error.message);
      return { event: null, error: error.message };
    }

    if (!data) {
      return {
        event: null,
        error: 'Event not found. Please check the event code.',
      };
    }

    return {
      event: normalizeCloudEvent(data),
      error: null,
    };
  } catch (error) {
    console.error('getEventByCode exception:', error);

    return {
      event: null,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to find the event.',
    };
  }
}

/**
 * Close or reopen an event using events.status.
 * Database RLS policies must authorize the requested update.
 */
export async function setEventClosed(
  eventId: string,
  isClosed: boolean,
): Promise<{ event: CloudEvent | null; error: string | null }> {
  try {
    if (!eventId.trim()) {
      return {
        event: null,
        error: 'A valid event ID is required.',
      };
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        event: null,
        error: 'You must be signed in to manage events.',
      };
    }

    const status: EventStatus = isClosed ? 'closed' : 'open';

    const { data, error } = await supabase
      .from('events')
      .update({ status })
      .eq('id', eventId)
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('setEventClosed error:', error.message);

      return {
        event: null,
        error: error.message,
      };
    }

    if (!data) {
      return {
        event: null,
        error:
          'The event was not updated. Check your teacher/admin permissions and Supabase RLS policies.',
      };
    }

    return {
      event: normalizeCloudEvent(data),
      error: null,
    };
  } catch (error) {
    console.error('setEventClosed exception:', error);

    return {
      event: null,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to update the event status.',
    };
  }
}

/**
 * Delete an event created by the currently signed-in user.
 */
export async function deleteEvent(
  eventId: string,
): Promise<{ success: boolean; error: string | null }> {
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        success: false,
        error: 'You must be signed in to delete an event.',
      };
    }

    const { data, error } = await supabase
      .from('events')
      .delete()
      .eq('id', eventId)
      .eq('created_by', user.id)
      .select('id');

    if (error) {
      console.error('deleteEvent error:', error.message);
      return { success: false, error: error.message };
    }

    if (!data || data.length === 0) {
      return {
        success: false,
        error:
          'Event was not deleted. It may not exist, may belong to another user, or your permissions may not allow deletion.',
      };
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('deleteEvent exception:', error);

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to delete the event.',
    };
  }
}

/**
 * Update an event created by the currently signed-in user.
 * Status is managed separately and cannot be changed through this function.
 */
export async function updateEvent(
  eventId: string,
  updates: Partial<
    Pick<
      CloudEvent,
      | 'event_code'
      | 'title'
      | 'location'
      | 'description'
      | 'start_time'
      | 'end_time'
    >
  >,
): Promise<{ event: CloudEvent | null; error: string | null }> {
  try {
    if (!eventId.trim()) {
      return {
        event: null,
        error: 'A valid event ID is required.',
      };
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        event: null,
        error: 'You must be signed in to update an event.',
      };
    }

    if (Object.keys(updates).length === 0) {
      return {
        event: null,
        error: 'No changes were provided.',
      };
    }

    const safeUpdates = { ...updates };

    if (safeUpdates.event_code !== undefined) {
      safeUpdates.event_code = safeUpdates.event_code.trim().toUpperCase();

      if (!safeUpdates.event_code) {
        return { event: null, error: 'Event code is required.' };
      }
    }

    if (safeUpdates.title !== undefined) {
      safeUpdates.title = safeUpdates.title.trim();

      if (!safeUpdates.title) {
        return { event: null, error: 'Event title is required.' };
      }
    }

    const { data, error } = await supabase
      .from('events')
      .update(safeUpdates)
      .eq('id', eventId)
      .eq('created_by', user.id)
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('updateEvent error:', error.message);
      return { event: null, error: error.message };
    }

    if (!data) {
      return {
        event: null,
        error:
          'Event was not updated. It may not exist, may belong to another user, or your permissions may not allow updating it.',
      };
    }

    return {
      event: normalizeCloudEvent(data),
      error: null,
    };
  } catch (error) {
    console.error('updateEvent exception:', error);

    return {
      event: null,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to update the event.',
    };
  }
}
