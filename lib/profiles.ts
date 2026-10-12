import { supabase } from './supabase';

export type Role = 'student' | 'teacher' | 'admin';

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
};

/**
 * Converts the role stored in Supabase into the role
 * used by the application.
 *
 * The database may store "administrator", while the
 * application uses "admin".
 */
function normalizeRole(value: unknown): Role | null {
  if (value === 'student' || value === 'teacher') {
    return value;
  }

  if (value === 'admin' || value === 'administrator') {
    return 'admin';
  }

  return null;
}

/**
 * Retrieves a user's profile from Supabase.
 */
export async function getProfile(
  userId: string
): Promise<Profile | null> {
  if (!userId?.trim()) {
    return null;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('getProfile failed:', error.message);
    return null;
  }

  if (!data) {
    return null;
  }

  const role = normalizeRole(data.role);

  // Do not treat an unknown database role as a valid role.
  if (!role) {
    console.error('getProfile: Unrecognized profile role.');
    return null;
  }

  return {
    id: data.id,
    email: data.email,
    full_name: data.full_name,
    role,
  };
}

/**
 * Updates the editable fields of a user's profile.
 * Role changes are intentionally not allowed here.
 */
export async function updateProfile(
  userId: string,
  updates: {
    full_name?: string;
  }
): Promise<{ error: string | null }> {
  if (!userId?.trim()) {
    return {
      error: 'A valid user ID is required.',
    };
  }

  if (updates.full_name !== undefined) {
    const fullName = updates.full_name.trim();

    if (!fullName) {
      return {
        error: 'Full name cannot be empty.',
      };
    }

    if (fullName.length > 150) {
      return {
        error: 'Full name cannot exceed 150 characters.',
      };
    }

    updates = {
      ...updates,
      full_name: fullName,
    };
  }

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);

  if (error) {
    console.error('updateProfile failed:', error.message);

    return {
      error: error.message,
    };
  }

  return {
    error: null,
  };
}