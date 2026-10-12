
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
 * Generates a code only when the caller does not provide one.
 */
function generateEventCode(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomPart = Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase();

  return `EVT-${timestamp}-${randomPart}`;
}

export async function createEvent(
  title: string,
  start: string | null,
  end: string | null,
  description: string = '',
  location: string = '',
  eventCode: string = ''
): Promise<{
  event: CloudEvent | null;
  error: string | null;
}> {
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

    if (!title.trim()) {
      return {
        event: null,
        error: 'Event title is required.',
      };
    }

    // Use the exact code supplied by the creation form.
    // Generate one only if no code was supplied.
    const finalEventCode = eventCode.trim() || generateEventCode();

    const { data, error } = await supabase
      .from('events')
      .insert({
        event_code: finalEventCode,
        title: title.trim(),
        location: location.trim() || null,
        description: description.trim() || null,
        start_time: start,
        end_time: end,
        created_by: user.id,
      })
      .select('*')
      .single();

    if (error) {
      console.error('createEvent failed:', error.message);

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
    console.error('createEvent failed:', error);

    return {
      event: null,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to create event.',
    };
  }
}

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
      console.error('getEventsByTeacher failed:', error.message);

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
    console.error('getEventsByTeacher failed:', error);

    return {
      events: [],
      error:
        error instanceof Error
          ? error.message
          : 'Failed to load events.',
    };
  }
}

export async function getEventByCode(
  eventCode: string
): Promise<{
  event: CloudEvent | null;
  error: string | null;
}> {
  try {
    const normalizedCode = eventCode.trim();

    if (!normalizedCode) {
      return {
        event: null,
        error: 'Event code is required.',
      };
    }

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('event_code', normalizedCode)
      .maybeSingle();

    if (error) {
      console.error('getEventByCode failed:', error.message);

      return {
        event: null,
        error: error.message,
      };
    }

    if (!data) {
      return {
        event: null,
        error: 'Event not found.',
      };
    }

    return {
      event: data as CloudEvent,
      error: null,
    };
  } catch (error) {
    console.error('getEventByCode failed:', error);

    return {
      event: null,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to find event.',
    };
  }
}

export async function deleteEvent(
  eventId: string
): Promise<{ error: string | null }> {
  try {
    if (!eventId) {
      return { error: 'Invalid event ID.' };
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        error: 'You must be signed in to delete an event.',
      };
    }

    const { data: existingEvent, error: findError } = await supabase
      .from('events')
      .select('id')
      .eq('id', eventId)
      .eq('created_by', user.id)
      .maybeSingle();

    if (findError) {
      console.error('deleteEvent lookup failed:', findError.message);
      return { error: findError.message };
    }

    if (!existingEvent) {
      return {
        error:
          'Event not found or you do not have permission to delete it.',
      };
    }

    const { data, error } = await supabase
      .from('events')
      .delete()
      .eq('id', eventId)
      .eq('created_by', user.id)
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('deleteEvent failed:', error.message);
      return { error: error.message };
    }

    if (!data) {
      return {
        error: 'Event could not be deleted. Check your permissions.',
      };
    }

    return { error: null };
  } catch (error) {
    console.error('deleteEvent failed:', error);

    return {
      error:
        error instanceof Error
          ? error.message
          : 'Failed to delete event.',
    };
  }
}

export async function updateEvent(
  eventId: string,
  updates: {
    title: string;
    start: string | null;
    end: string | null;
    location?: string;
    description?: string;
  }
): Promise<{ error: string | null }> {
  try {
    if (!eventId) {
      return { error: 'Invalid event ID.' };
    }

    if (!updates.title.trim()) {
      return { error: 'Event title is required.' };
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        error: 'You must be signed in to update an event.',
      };
    }

    const updateData: {
      title: string;
      start_time: string | null;
      end_time: string | null;
      location?: string | null;
      description?: string | null;
    } = {
      title: updates.title.trim(),
      start_time: updates.start,
      end_time: updates.end,
    };

    if (updates.location !== undefined) {
      updateData.location = updates.location.trim() || null;
    }

    if (updates.description !== undefined) {
      updateData.description = updates.description.trim() || null;
    }

    const { data, error } = await supabase
      .from('events')
      .update(updateData)
      .eq('id', eventId)
      .eq('created_by', user.id)
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('updateEvent failed:', error.message);
      return { error: error.message };
    }

    if (!data) {
      return {
        error:
          'Event not found or you do not have permission to update it.',
      };
    }

    return { error: null };
  } catch (error) {
    console.error('updateEvent failed:', error);

    return {
      error:
        error instanceof Error
          ? error.message
          : 'Failed to update event.',
    };
  }
}
