import { useEffect, useState } from 'react';
import type { Session, User, AuthError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

export type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

export type SignupProfile = {
  full_name?: string;
  role?: 'student' | 'teacher' | 'admin';
};

type AuthResult<T> = {
  data: T | null;
  error: AuthError | Error | null;
};

let authState: AuthState = {
  session: null,
  user: null,
  loading: true,
};

const listeners = new Set<(state: AuthState) => void>();

let initialized = false;
let authEventVersion = 0;

function publishAuthState(
  session: Session | null,
  loading = false,
): void {
  authState = {
    session,
    user: session?.user ?? null,
    loading,
  };

  listeners.forEach((listener) => listener(authState));
}

function initializeAuth(): void {
  if (initialized) return;

  initialized = true;

  // Subscribe before restoring the saved session.
  supabase.auth.onAuthStateChange((_event, session) => {
    authEventVersion += 1;
    publishAuthState(session, false);
  });

  const initialVersion = authEventVersion;

  void supabase.auth
    .getSession()
    .then(({ data, error }) => {
      if (error) {
        console.error(
          'Unable to restore authentication session:',
          error.message,
        );
      }

      // Do not overwrite a newer sign-in or sign-out event.
      if (authEventVersion !== initialVersion) return;

      publishAuthState(data.session ?? null, false);
    })
    .catch((error: unknown) => {
      console.error('Authentication initialization failed:', error);

      if (authEventVersion !== initialVersion) return;

      publishAuthState(null, false);
    });
}

initializeAuth();

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>(authState);

  useEffect(() => {
    const listener = (nextState: AuthState) => {
      setState(nextState);
    };

    listeners.add(listener);
    setState(authState);

    return () => {
      listeners.delete(listener);
    };
  }, []);

  return state;
}

export async function signUp(
  email: string,
  password: string,
  profile?: SignupProfile,
): Promise<
  AuthResult<{
    user: User | null;
    session: Session | null;
  }>
> {
  try {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      return {
        data: null,
        error: new Error('Email and password are required.'),
      };
    }

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          full_name: profile?.full_name?.trim() || null,
        },
      },
    });

    if (error) {
      return { data: null, error };
    }

    // Supabase's auth listener updates the session when one is issued.
    if (data.session) {
      publishAuthState(data.session);
    }

    return {
      data: {
        user: data.user,
        session: data.session,
      },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error:
        error instanceof Error
          ? error
          : new Error('Registration failed unexpectedly.'),
    };
  }
}

export async function signIn(
  email: string,
  password: string,
): Promise<
  AuthResult<{
    user: User;
    session: Session;
  }>
> {
  try {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      return {
        data: null,
        error: new Error('Email and password are required.'),
      };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      return { data: null, error };
    }

    if (!data.user || !data.session) {
      return {
        data: null,
        error: new Error('Login succeeded without a valid session.'),
      };
    }

    // Fixing: publish the authenticated session immediately.
    publishAuthState(data.session, false);

    return {
      data: {
        user: data.user,
        session: data.session,
      },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error:
        error instanceof Error
          ? error
          : new Error('Login failed unexpectedly.'),
    };
  }
}

export async function signOut(): Promise<{
  error: AuthError | Error | null;
}> {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      return { error };
    }

    publishAuthState(null, false);

    return { error: null };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error
          : new Error('Failed to sign out.'),
    };
  }
}