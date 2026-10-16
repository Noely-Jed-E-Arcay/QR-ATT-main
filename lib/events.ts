
import { supabase } from './supabase';

export type Event = {
  eventId: string;
  title: string;
  location?: string;
  description?: string;
  start: string;
  end: string;
};

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
};

/**
 * Create a new event.
 * Only authenticated users can create events when permitted by RLS.
 */
export async function createEvent(
  event: Omit<CloudEvent, 'id' | 'created_at' | 'created_by'>,
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
        event_code: event.event_code,
        title: event.title,
        location: event.location,
        description: event.description,
        start_time: event.start_time,
        end_time: event.end_time,
        created_by: user.id,
      })
      .select('*')
      .single();

    if (error) {
      console.error('createEvent error:', error.message);

      return {
        event: null,
        error: error.message,
      };
    }

    return {
      event: data as CloudEvent,
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
 *
 * IMPORTANT:
 * This function does not remove past or completed events.
 * Supabase Row Level Security (RLS) still controls which rows
 * the signed-in user is allowed to read.
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

    const { data, error, count } = await supabase
      .from('events')
      .select('*', { count: 'exact' })
      .order('start_time', {
        ascending: true,
        nullsFirst: false,
      });

    if (error) {
      console.error('getAvailableEvents error:', error.message);

      return {
        events: [],
        error: error.message,
      };
    }

    const allEvents = (data ?? []) as CloudEvent[];

    console.log('Available Events Debug:', {
      signedInUser: user.id,
      returnedRows: allEvents.length,
      exactCount: count,
      eventCodes: allEvents.map((event) => event.event_code),
      events: allEvents.map((event) => ({
        id: event.id,
        title: event.title,
        start_time: event.start_time,
        end_time: event.end_time,
      })),
    });

    return {
      events: allEvents,
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
 * Get events created by the currently signed-in teacher.
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

      return {
        events: [],
        error: error.message,
      };
    }

    return {
      events: (data ?? []) as CloudEvent[],
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
    const normalizedCode = eventCode.trim();

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

      return {
        event: null,
        error: error.message,
      };
    }

    if (!data) {
      return {
        event: null,
        error: 'Event not found. Please check the event code.',
      };
    }

    return {
      event: data as CloudEvent,
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
 * Delete an event created by the currently signed-in user.
 * Supabase RLS must also permit the deletion.
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

      return {
        success: false,
        error: error.message,
      };
    }

    if (!data || data.length === 0) {
      return {
        success: false,
        error:
          'Event was not deleted. It may not exist, may belong to another user, or your permissions may not allow deletion.',
      };
    }

    return {
      success: true,
      error: null,
    };
  } catch (error) {
    console.error('deleteEvent exception:', error);

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to delete event.',
    };
  }
}

/**
 * Update an event created by the currently signed-in user.
 * Supabase RLS must also permit the update.
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

    const { data, error } = await supabase
      .from('events')
      .update(updates)
      .eq('id', eventId)
      .eq('created_by', user.id)
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('updateEvent error:', error.message);

      return {
        event: null,
        error: error.message,
      };
    }

    if (!data) {
      return {
        event: null,
        error:
          'Event was not updated. It may not exist, may belong to another user, or your permissions may not allow updating it.',
      };
    }

    return {
      event: data as CloudEvent,
      error: null,
    };
  } catch (error) {
    console.error('updateEvent exception:', error);

    return {
      event: null,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to update event.',
    };
  }
}
