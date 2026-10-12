import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppButton from '@/components/AppButton';
import Header from '@/components/Header';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { getProfile } from '@/lib/profiles';

type UserRole = 'student' | 'teacher' | 'admin';

export default function Index() {
  const { user } = useAuth();
  const { width } = useWindowDimensions();

  const [role, setRole] = useState<UserRole>('student');
  const [loadingRole, setLoadingRole] = useState(true);

  const isSmallScreen = width < 380;

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function loadRole() {
        if (!user) {
          if (active) {
            setRole('student');
            setLoadingRole(false);
          }
          return;
        }

        try {
          const profile = await getProfile(user.id);

          if (active) {
            const profileRole = profile?.role;

            if (profileRole === 'admin') {
              setRole('admin');
            } else if (profileRole === 'teacher') {
              setRole('teacher');
            } else {
              setRole('student');
            }
          }
        } catch (error) {
          console.error('Failed to load user role:', error);
        } finally {
          if (active) {
            setLoadingRole(false);
          }
        }
      }

      setLoadingRole(true);
      loadRole();

      return () => {
        active = false;
      };
    }, [user])
  );

  const isAdministrator = role === 'admin';
  const isTeacher = role === 'teacher';

  const welcomeTitle = isAdministrator
    ? 'School Overview'
    : isTeacher
      ? 'Manage Your Events'
      : 'Welcome Back!';

  const welcomeMessage = isAdministrator
    ? 'Manage school activities and keep everyone informed.'
    : isTeacher
      ? 'Create events, generate QR codes, and monitor attendance.'
      : 'Stay updated with school activities and keep your attendance organized.';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerContainer}>
          <Header title="QR Attendance" />
        </View>

        <View style={styles.welcomeCard}>
          <View style={styles.welcomeTopRow}>
            <View style={styles.welcomeIcon}>
              <Ionicons
                name={
                  isAdministrator
                    ? 'shield-checkmark-outline'
                    : isTeacher
                      ? 'school-outline'
                      : 'person-outline'
                }
                size={24}
                color={COLORS.surface}
              />
            </View>

            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>
                {loadingRole
                  ? 'LOADING'
                  : isAdministrator
                    ? 'ADMINISTRATOR'
                    : isTeacher
                      ? 'TEACHER'
                      : 'STUDENT'}
              </Text>
            </View>
          </View>

          <Text style={styles.welcomeEyebrow}>YOUR DASHBOARD</Text>
          <Text style={styles.welcomeTitle}>{welcomeTitle}</Text>
          <Text style={styles.welcomeMessage}>{welcomeMessage}</Text>

          {loadingRole && (
            <ActivityIndicator
              size="small"
              color={COLORS.surface}
              style={styles.loadingIndicator}
            />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Action</Text>

          <View style={styles.scanCard}>
            <View style={styles.scanIconContainer}>
              <Ionicons
                name="qr-code-outline"
                size={28}
                color={COLORS.textPrimary}
              />
            </View>

            <View style={styles.scanTextContainer}>
              <Text style={styles.scanTitle}>
                {isTeacher
                  ? 'Event QR Management'
                  : isAdministrator
                    ? 'Attendance Access'
                    : 'Scan Event QR Code'}
              </Text>

              <Text style={styles.scanDescription}>
                {isTeacher
                  ? 'Manage your event QR codes.'
                  : isAdministrator
                    ? 'Open the attendance scanner.'
                    : 'Record attendance at school activities.'}
              </Text>
            </View>
          </View>

          <AppButton
            theme="primary"
            title={
              isTeacher
                ? 'Manage Events'
                : isAdministrator
                  ? 'Open Attendance Scanner'
                  : 'Scan QR Code'
            }
            icon={isTeacher ? 'calendar-outline' : 'qr-code-outline'}
            onPress={() => {
              if (isTeacher) {
                router.push('/teacher');
              } else {
                router.push('/scan');
              }
            }}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {isAdministrator
              ? 'Administration'
              : isTeacher
                ? 'Teacher Workspace'
                : 'My Attendance'}
          </Text>

          <View style={styles.shortcutGrid}>
            {isAdministrator ? (
              <>
                <ShortcutCard
                  compact={isSmallScreen}
                  icon="shield-checkmark-outline"
                  title="Admin Dashboard"
                  description="Manage school activities"
                  onPress={() => router.push('/administrator')}
                />
                <ShortcutCard
                  compact={isSmallScreen}
                  icon="time-outline"
                  title="Attendance History"
                  description="Review attendance records"
                  onPress={() => router.push('/history')}
                />
                <ShortcutCard
                  compact={isSmallScreen}
                  icon="calendar-outline"
                  title="School Events"
                  description="Access event management"
                  onPress={() => router.push('/administrator')}
                />
                <ShortcutCard
                  compact={isSmallScreen}
                  icon="person-outline"
                  title="My Profile"
                  description="View your account"
                  onPress={() => router.push('/profile')}
                />
              </>
            ) : isTeacher ? (
              <>
                <ShortcutCard
                  compact={isSmallScreen}
                  icon="calendar-outline"
                  title="Manage Events"
                  description="Create and manage events"
                  onPress={() => router.push('/teacher')}
                />
                <ShortcutCard
                  compact={isSmallScreen}
                  icon="qr-code-outline"
                  title="QR Scanner"
                  description="Scan an event QR code"
                  onPress={() => router.push('/scan')}
                />
                <ShortcutCard
                  compact={isSmallScreen}
                  icon="time-outline"
                  title="Attendance History"
                  description="View attendance records"
                  onPress={() => router.push('/history')}
                />
                <ShortcutCard
                  compact={isSmallScreen}
                  icon="person-outline"
                  title="My Profile"
                  description="View your account"
                  onPress={() => router.push('/profile')}
                />
              </>
            ) : (
              <>
                <ShortcutCard
                  compact={isSmallScreen}
                  icon="qr-code-outline"
                  title="Scan QR Code"
                  description="Record your attendance"
                  onPress={() => router.push('/scan')}
                />
                <ShortcutCard
                  compact={isSmallScreen}
                  icon="time-outline"
                  title="My History"
                  description="Review your attendance"
                  onPress={() => router.push('/history')}
                />
                <ShortcutCard
                  compact={isSmallScreen}
                  icon="calendar-outline"
                  title="School Events"
                  description="Check event information"
                  onPress={() => router.push('/history')}
                />
                <ShortcutCard
                  compact={isSmallScreen}
                  icon="person-outline"
                  title="My Profile"
                  description="Manage your account"
                  onPress={() => router.push('/profile')}
                />
              </>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.announcementHeader}>
            <View style={styles.announcementHeading}>
              <Ionicons
                name="megaphone-outline"
                size={20}
                color={COLORS.primary}
              />
              <Text style={styles.sectionTitle}>Announcements</Text>
            </View>

            <View style={styles.comingSoonBadge}>
              <Text style={styles.comingSoonText}>COMING SOON</Text>
            </View>
          </View>

          <View style={styles.announcementCard}>
            <View style={styles.announcementIcon}>
              <Ionicons
                name="notifications-outline"
                size={22}
                color={COLORS.primary}
              />
            </View>

            <View style={styles.announcementContent}>
              <Text style={styles.announcementTitle}>Stay in the Loop</Text>
              <Text style={styles.announcementDescription}>
                {isAdministrator
                  ? 'School announcements will be managed here in a future update.'
                  : 'School notices, event reminders, and important updates will appear here.'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Ionicons
            name="heart-outline"
            size={14}
            color={COLORS.textSecondary}
          />
          <Text style={styles.footerText}>School Event Attendance</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type ShortcutCardProps = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  description: string;
  onPress: () => void;
  compact: boolean;
};

function ShortcutCard({
  icon,
  title,
  description,
  onPress,
  compact,
}: ShortcutCardProps) {
  return (
    <View
      style={[
        styles.shortcutCard,
        compact && styles.shortcutCardCompact,
      ]}
    >
      <View style={styles.shortcutIcon}>
        <Ionicons
          name={icon}
          size={21}
          color={COLORS.primary}
        />
      </View>

      <Text style={styles.shortcutTitle}>{title}</Text>

      <Text style={styles.shortcutDescription}>{description}</Text>

      <View style={styles.shortcutAction}>
        <Text style={styles.shortcutActionText}>Open</Text>
        <Ionicons
          name="arrow-forward"
          size={13}
          color={COLORS.primary}
        />
      </View>

      <View style={styles.shortcutButtonContainer}>
        <AppButton
          title={title}
          icon={icon}
          onPress={onPress}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 24,
  },

  headerContainer: {
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 12,
  },

  welcomeCard: {
    backgroundColor: COLORS.textSecondary,
    borderRadius: 20,
    padding: 18,
    marginBottom: 22,
    overflow: 'hidden',
  },

  welcomeTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },

  welcomeIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  roleBadge: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  roleBadgeText: {
    color: COLORS.textSecondary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  welcomeEyebrow: {
    color: COLORS.surface,
    opacity: 0.85,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 7,
  },

  welcomeTitle: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '800',
    marginBottom: 7,
  },

  welcomeMessage: {
    color: COLORS.background,
    fontSize: 13,
    lineHeight: 19,
    maxWidth: 300,
  },

  loadingIndicator: {
    alignSelf: 'flex-start',
    marginTop: 10,
  },

  section: {
    marginBottom: 22,
  },

  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 11,
  },

  scanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 13,
    marginBottom: 12,
    gap: 11,
  },

  scanIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scanTextContainer: {
    flex: 1,
  },

  scanTitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },

  scanDescription: {
    color: COLORS.textSecondary,
    fontSize: 11,
    lineHeight: 16,
  },

  shortcutGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  shortcutCard: {
    width: '48.5%',
    backgroundColor: COLORS.card,
    borderRadius: 15,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.surface,
    marginBottom: 10,
  },

  shortcutCardCompact: {
    padding: 10,
  },

  shortcutIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 9,
  },

  shortcutTitle: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },

  shortcutDescription: {
    color: COLORS.textSecondary,
    fontSize: 10,
    lineHeight: 14,
    minHeight: 28,
  },

  shortcutAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
  },

  shortcutActionText: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: '700',
  },

  shortcutButtonContainer: {
    marginTop: 8,
  },

  announcementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },

  announcementHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flex: 1,
  },

  comingSoonBadge: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 20,
  },

  comingSoonText: {
    color: COLORS.textSecondary,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.4,
  },

  announcementCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.card,
    borderRadius: 15,
    padding: 13,
    borderWidth: 1,
    borderColor: COLORS.surface,
    gap: 10,
  },

  announcementIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  announcementContent: {
    flex: 1,
  },

  announcementTitle: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },

  announcementDescription: {
    color: COLORS.textSecondary,
    fontSize: 11,
    lineHeight: 17,
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 2,
    paddingVertical: 10,
  },

  footerText: {
    color: COLORS.textSecondary,
    fontSize: 10,
  },
});