import { supabase } from '@/lib/supabase';

export type AnnouncementAudience = 'all' | 'student' | 'teacher';

export type Announcement = {
  id: string;
  title: string;
  message: string;
  target_audience: AnnouncementAudience;
  created_by: string;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  is_read: boolean;
};

export type CreateAnnouncementInput = {
  title: string;
  message: string;
  target_audience: AnnouncementAudience;
  is_published: boolean;
};

export type UpdateAnnouncementInput =
  Partial<CreateAnnouncementInput>;

export type ServiceResult<T> = {
  data: T;
  error: string | null;
};

type AnnouncementRow = Omit<Announcement, 'is_read'>;

const ANNOUNCEMENT_COLUMNS =
  'id, title, message, target_audience, created_by, is_published, published_at, created_at, updated_at';

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'An unexpected error occurred.';
}

/**
 * Fetch published announcements for the specified user.
 * Supabase RLS policies must restrict which announcements
 * the signed-in user is allowed to access.
 */
export async function getAnnouncements(
  userId: string,
  role: string,
): Promise<ServiceResult<Announcement[]>> {
  try {
    const { data: rows, error } = await supabase
      .from('announcements')
      .select(ANNOUNCEMENT_COLUMNS)
      .eq('is_published', true)
      .order('published_at', { ascending: false });

    if (error) {
      return { data: [], error: error.message };
    }

    const visibleRows = (
      (rows ?? []) as unknown as AnnouncementRow[]
    ).filter(
      (announcement) =>
        announcement.target_audience === 'all' ||
        announcement.target_audience === role,
    );

    if (visibleRows.length === 0) {
      return { data: [], error: null };
    }

    const { data: readRows, error: readError } = await supabase
      .from('announcement_reads')
      .select('announcement_id')
      .eq('user_id', userId)
      .in(
        'announcement_id',
        visibleRows.map((announcement) => announcement.id),
      );

    if (readError) {
      return { data: [], error: readError.message };
    }

    const readIds = new Set(
      (readRows ?? []).map((row) => row.announcement_id as string),
    );

    return {
      data: visibleRows.map((announcement) => ({
        ...announcement,
        is_read: readIds.has(announcement.id),
      })),
      error: null,
    };
  } catch (error) {
    return {
      data: [],
      error: getErrorMessage(error),
    };
  }
}

/**
 * Fetch all announcements for administrator management,
 * including unpublished announcements.
 */
export async function getAllAnnouncements(): Promise<
  ServiceResult<Announcement[]>
> {
  try {
    const { data, error } = await supabase
      .from('announcements')
      .select(ANNOUNCEMENT_COLUMNS)
      .order('created_at', { ascending: false });

    if (error) {
      return { data: [], error: error.message };
    }

    return {
      data: ((data ?? []) as unknown as AnnouncementRow[]).map(
        (announcement) => ({
          ...announcement,
          is_read: false,
        }),
      ),
      error: null,
    };
  } catch (error) {
    return {
      data: [],
      error: getErrorMessage(error),
    };
  }
}

/**
 * Create an announcement.
 * The current user's permissions are enforced by Supabase RLS.
 */
export async function createAnnouncement(
  input: CreateAnnouncementInput,
  userId: string,
): Promise<ServiceResult<Announcement | null>> {
  try {
    const title = input.title.trim();
    const message = input.message.trim();

    if (!title || !message) {
      return {
        data: null,
        error: 'Please enter both a title and a message.',
      };
    }

    const { data, error } = await supabase
      .from('announcements')
      .insert({
        title,
        message,
        target_audience: input.target_audience,
        is_published: input.is_published,
        created_by: userId,
        published_at: input.is_published
          ? new Date().toISOString()
          : null,
      })
      .select(ANNOUNCEMENT_COLUMNS)
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return {
      data: {
        ...(data as unknown as AnnouncementRow),
        is_read: false,
      },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: getErrorMessage(error),
    };
  }
}

/**
 * Update an existing announcement.
 */
export async function updateAnnouncement(
  announcementId: string,
  input: UpdateAnnouncementInput,
): Promise<ServiceResult<Announcement | null>> {
  try {
    const updates: {
      title?: string;
      message?: string;
      target_audience?: AnnouncementAudience;
      is_published?: boolean;
      published_at?: string | null;
      updated_at: string;
    } = {
      updated_at: new Date().toISOString(),
    };

    if (input.title !== undefined) {
      if (!input.title.trim()) {
        return {
          data: null,
          error: 'The title cannot be empty.',
        };
      }

      updates.title = input.title.trim();
    }

    if (input.message !== undefined) {
      if (!input.message.trim()) {
        return {
          data: null,
          error: 'The message cannot be empty.',
        };
      }

      updates.message = input.message.trim();
    }

    if (input.target_audience !== undefined) {
      updates.target_audience = input.target_audience;
    }

    if (input.is_published !== undefined) {
      updates.is_published = input.is_published;
      updates.published_at = input.is_published
        ? new Date().toISOString()
        : null;
    }

    const { data, error } = await supabase
      .from('announcements')
      .update(updates)
      .eq('id', announcementId)
      .select(ANNOUNCEMENT_COLUMNS)
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return {
      data: {
        ...(data as unknown as AnnouncementRow),
        is_read: false,
      },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: getErrorMessage(error),
    };
  }
}

/**
 * Delete an announcement.
 * Supabase RLS must authorize the operation.
 */
export async function deleteAnnouncement(
  announcementId: string,
): Promise<ServiceResult<boolean>> {
  try {
    const { data, error } = await supabase
      .from('announcements')
      .delete()
      .eq('id', announcementId)
      .select('id');

    if (error) {
      return { data: false, error: error.message };
    }

    if (!data?.length) {
      return {
        data: false,
        error: 'Announcement was not deleted. Check your permissions.',
      };
    }

    return { data: true, error: null };
  } catch (error) {
    return {
      data: false,
      error: getErrorMessage(error),
    };
  }
}

/**
 * Mark an announcement as read by the signed-in user.
 */
export async function markAnnouncementAsRead(
  announcementId: string,
  userId: string,
): Promise<ServiceResult<boolean>> {
  try {
    const { error } = await supabase
      .from('announcement_reads')
      .upsert(
        {
          announcement_id: announcementId,
          user_id: userId,
        },
        {
          onConflict: 'announcement_id,user_id',
          ignoreDuplicates: true,
        },
      );

    if (error) {
      return { data: false, error: error.message };
    }

    return { data: true, error: null };
  } catch (error) {
    return {
      data: false,
      error: getErrorMessage(error),
    };
  }
}