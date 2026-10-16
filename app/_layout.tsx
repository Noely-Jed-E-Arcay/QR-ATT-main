// Fixing: Keep the root navigator mounted and centralize auth redirects.

import { useEffect } from 'react';
import {
  Redirect,
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

export default function RootLayout() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

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

    if (!session && inProtectedGroup) {
      router.replace('/login');
      return;
    }

    if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
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