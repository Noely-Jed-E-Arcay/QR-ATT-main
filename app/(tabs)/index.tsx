import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import AppButton from '@/components/AppButton';
import Header from '@/components/Header';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { getProfile } from '@/lib/profiles';

export default function Index() {
  const { user } = useAuth();
  const [isAdministrator, setIsAdministrator] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function loadRole() {
        if (!user) {
          setIsAdministrator(false);
          return;
        }

        const profile = await getProfile(user.id);

        if (active) {
          setIsAdministrator(profile?.role === 'admin');
        }
      }

      loadRole();

      return () => {
        active = false;
      };
    }, [user])
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerContainer}>
          <Header title="QR Attendance" />
        </View>

        <View style={styles.bodyContainer}>
          <Text style={styles.mainTitle}>School Event Attendance</Text>
          <Text style={styles.subtitle}>
            Scan QR Codes to record attendance during school activities.
          </Text>
        </View>

        <View style={styles.footerContainer}>
          <AppButton
            theme="primary"
            title="Scan QR Code"
            icon="qr-code-outline"
            onPress={() => router.push('/scan')}
          />

          <AppButton
            title="Attendance History"
            icon="time-outline"
            onPress={() => router.push('/history')}
          />

          {isAdministrator && (
            <AppButton
              title="Administrator Dashboard"
              icon="shield-checkmark-outline"
              onPress={() => router.push('/administrator')}
            />
          )}

          <AppButton
            title="Profile"
            icon="person-outline"
            onPress={() => router.push('/profile')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 30,
  },
  headerContainer: {
    marginTop: 120,
    marginBottom: 32,
    alignItems: 'center',
  },
  bodyContainer: {
    marginTop: 20,
    paddingHorizontal: 32,
    marginBottom: 16,
  },
  mainTitle: {
    marginTop: 10,
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 21,
  },
  footerContainer: {
    alignItems: 'center',
    paddingHorizontal: 24,
    width: '100%',
  },
});
