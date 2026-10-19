// Fixing: Centralize authentication and role-aware redirects.
import { useEffect, useRef } from 'react';
import {
  Stack,
  useRouter,
  useSegments,
} from 'expo-router';
import {
  ActivityIndicator,
  StyleSheet,
  View,
} from 'react-native';

import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { getProfile } from '@/lib/profiles';

export default function RootLayout() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  const redirectingRef = useRef(false);
  const currentRoute = segments[0];

  const inAuthGroup =
    currentRoute === 'login' ||
    currentRoute === 'register';

  const inProtectedGroup =
    currentRoute === '(tabs)' ||
    currentRoute === 'administrator' ||
    currentRoute === 'teacher' ||
    currentRoute === 'scan' ||
    currentRoute === 'history' ||
    currentRoute === 'profile';

  useEffect(() => {
    if (loading) return;

    let cancelled = false;

    async function handleRedirect() {
      if (!session) {
        redirectingRef.current = false;

        if (inProtectedGroup) {
          router.replace('/login');
        }

        return;
      }

      if (!inAuthGroup) return;
      if (redirectingRef.current) return;

      redirectingRef.current = true;

      try {
        const profile = await getProfile(session.user.id);

        if (cancelled) return;

        if (!profile) {
          router.replace('/login');
          return;
        }

        if (profile.role === 'admin') {
          router.replace('/administrator');
          return;
        }

        router.replace('/(tabs)');
      } catch (error) {
        console.error('Role-aware redirect failed:', error);

        if (!cancelled) {
          router.replace('/login');
        }
      } finally {
        if (!cancelled) {
          redirectingRef.current = false;
        }
      }
    }

    void handleRedirect();

    return () => {
      cancelled = true;
    };
  }, [
    session,
    loading,
    inAuthGroup,
    inProtectedGroup,
    router,
  ]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
        />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="administrator" />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
});