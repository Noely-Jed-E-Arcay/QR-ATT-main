// Fixing: Verify administrator access before loading protected dashboard data.

import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import {
  getAdminDashboard,
  type AdminDashboard,
} from '@/lib/admin';
import { getProfile } from '@/lib/profiles';

export default function AdministratorDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < 380;

  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [adminName, setAdminName] = useState('Administrator');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState(false);

  const requestId = useRef(0);

  const loadDashboard = useCallback(async () => {
    const currentRequest = ++requestId.current;

    const isCurrentRequest = () => requestId.current === currentRequest;

    setError(null);

    if (!user) {
      setDashboard(null);
      setAdminName('Administrator');
      setAuthorized(false);
      setLoading(false);
      setError('Please sign in to view the administrator dashboard.');
      return;
    }

    setLoading(true);

    try {
      // Verify the user's profile BEFORE requesting dashboard data.
      const profile = await getProfile(user.id);

      if (!isCurrentRequest()) return;

      if (!profile || profile.id !== user.id) {
        setDashboard(null);
        setAdminName('Administrator');
        setAuthorized(false);
        setError(
          'Your account profile could not be verified. Please sign in again or contact an administrator.',
        );
        return;
      }

      if (profile.role !== 'admin') {
        setDashboard(null);
        setAdminName('Administrator');
        setAuthorized(false);
        setError(
          'Access denied. This dashboard is available to administrators only.',
        );
        return;
      }

      setAuthorized(true);
      setAdminName(profile.full_name?.trim() || 'Administrator');

      const result = await getAdminDashboard();

      if (!isCurrentRequest()) return;

      if (result.error || !result.data) {
        setDashboard(null);
        setError(
          result.error || 'Unable to retrieve dashboard information.',
        );
        return;
      }

      setDashboard(result.data);
    } catch (err) {
      if (!isCurrentRequest()) return;

      console.error('Failed to load administrator dashboard:', err);
      setDashboard(null);
      setError('Unable to load dashboard information. Please try again.');
    } finally {
      if (isCurrentRequest()) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void loadDashboard();

      return () => {
        // Ignore responses from requests started before leaving this screen.
        requestId.current += 1;
      };
    }, [loadDashboard]),
  );

  const refresh = useCallback(() => {
    setRefreshing(true);
    void loadDashboard();
  }, [loadDashboard]);

  const managementActions = [
    {
      icon: 'people-outline' as const,
      title: 'Manage Users',
      description: 'View accounts and roles.',
      color: '#8B684D',
      onPress: () => router.push('/administrator/users'),
    },
    {
      icon: 'person-add-outline' as const,
      title: 'Teacher Verification',
      description: 'Review teacher requests.',
      color: '#A4774F',
      onPress: () => router.push('/administrator/teacher-requests'),
    },
    {
      icon: 'calendar-outline' as const,
      title: 'Manage Events',
      description: 'Create and update events.',
      color: '#7A6858',
      onPress: () => router.push('/administrator/events'),
    },
    {
      icon: 'create-outline' as const,
      title: 'Attendance',
      description: 'Review attendance records.',
      color: '#66816B',
      onPress: () => router.push('/administrator/attendance'),
    },
    {
      icon: 'bar-chart-outline' as const,
      title: 'Reports & Records',
      description: 'View reports and activity.',
      color: '#8B684D',
      onPress: () => router.push('/administrator/reports'),
    },
  ];

  if (loading) {
    return (
      <View style={styles.center}>
        <View style={styles.loadingIcon}>
          <Ionicons
            name="shield-checkmark-outline"
            size={28}
            color={COLORS.primary}
          />
        </View>

        <ActivityIndicator
          size="large"
          color={COLORS.primary}
          style={styles.loadingSpinner}
        />

        <Text style={styles.loadingTitle}>Verifying administrator</Text>
        <Text style={styles.muted}>
          Checking your account and retrieving school records.
        </Text>
      </View>
    );
  }

  // Fail closed: do not render management actions for an unverified account.
  if (!authorized) {
    return (
      <View style={styles.center}>
        <View style={styles.deniedIcon}>
          <Ionicons
            name="lock-closed-outline"
            size={30}
            color={COLORS.danger}
          />
        </View>

        <Text style={styles.deniedTitle}>Dashboard unavailable</Text>

        <Text style={styles.deniedDescription}>
          {error || 'Your administrator access could not be verified.'}
        </Text>

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void loadDashboard();
          }}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="refresh-outline" size={17} color={COLORS.textOnPrimary} />
          <Text style={styles.primaryButtonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const totalUsers = dashboard?.userCount ?? 0;
  const totalStudents = dashboard?.studentCount ?? 0;
  const totalTeachers = dashboard?.teacherCount ?? 0;
  const totalAdmins = dashboard?.administratorCount ?? 0;
  const totalEvents = dashboard?.eventCount ?? 0;
  const totalAttendance = dashboard?.attendanceCount ?? 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
          tintColor={COLORS.primary}
          colors={[COLORS.primary]}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* HEADER */}
      <View style={styles.topBar}>
        <View style={styles.brandIcon}>
          <Ionicons
            name="qr-code-outline"
            size={23}
            color={COLORS.surface}
          />
        </View>

        <View style={styles.brandTextContainer}>
          <Text style={styles.brandTitle}>QR Attendance</Text>
          <Text style={styles.brandSubtitle}>SCHOOL MANAGEMENT</Text>
        </View>

        <View style={styles.adminBadge}>
          <Ionicons
            name="shield-checkmark"
            size={19}
            color={COLORS.primary}
          />
        </View>
      </View>

      {/* WELCOME CARD */}
      <View style={styles.welcomeCard}>
        <View style={styles.welcomeTop}>
          <View style={styles.welcomeLabelContainer}>
            <View style={styles.statusDot} />
            <Text style={styles.welcomeLabel}>ADMIN CONTROL CENTER</Text>
          </View>

          <Ionicons
            name="grid-outline"
            size={22}
            color={COLORS.surface}
          />
        </View>

        <Text style={styles.welcomeTitle}>Welcome back,</Text>

        <Text style={styles.adminName} numberOfLines={2}>
          {adminName}
        </Text>

        <Text style={styles.welcomeDescription}>
          Manage users, events, attendance, and teacher verification.
        </Text>

        <View style={styles.welcomeFooter}>
          <Ionicons
            name="sync-outline"
            size={14}
            color={COLORS.surface}
          />
          <Text style={styles.welcomeFooterText}>
            Pull down to refresh
          </Text>
        </View>
      </View>

      {/* DASHBOARD DATA ERROR */}
      {error && (
        <View style={styles.errorCard}>
          <Ionicons
            name="alert-circle-outline"
            size={22}
            color={COLORS.danger}
          />

          <View style={styles.errorBody}>
            <Text style={styles.errorTitle}>
              Unable to update dashboard
            </Text>

            <Text style={styles.errorText}>{error}</Text>

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                void loadDashboard();
              }}
              style={({ pressed }) => [
                styles.retryButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* STATISTICS */}
      <SectionHeading
        title="School Overview"
        subtitle="Current system statistics"
        icon="analytics-outline"
      />

      {dashboard ? (
        <View style={styles.statsGrid}>
          <StatCard
            compact={compact}
            icon="people-outline"
            label="Total Users"
            value={totalUsers}
          />

          <StatCard
            compact={compact}
            icon="school-outline"
            label="Students"
            value={totalStudents}
          />

          <StatCard
            compact={compact}
            icon="briefcase-outline"
            label="Teachers"
            value={totalTeachers}
          />

          <StatCard
            compact={compact}
            icon="shield-checkmark-outline"
            label="Administrators"
            value={totalAdmins}
          />

          <StatCard
            compact={compact}
            icon="calendar-outline"
            label="Events"
            value={totalEvents}
          />

          <StatCard
            compact={compact}
            icon="checkmark-circle-outline"
            label="Attendance"
            value={totalAttendance}
          />
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Ionicons
            name="cloud-offline-outline"
            size={26}
            color={COLORS.primary}
          />
          <Text style={styles.emptyTitle}>Statistics unavailable</Text>
          <Text style={styles.emptyDescription}>
            Refresh the dashboard to try loading the latest records.
          </Text>
        </View>
      )}

      {/* MANAGEMENT */}
      <SectionHeading
        title="Management"
        subtitle="Choose an administrative tool"
        icon="apps-outline"
      />

      <View style={styles.managementGrid}>
        {managementActions.map((action) => (
          <ManagementCard
            key={action.title}
            compact={compact}
            icon={action.icon}
            title={action.title}
            description={action.description}
            color={action.color}
            onPress={action.onPress}
          />
        ))}
      </View>

      {/* RECENT ATTENDANCE */}
      <SectionHeading
        title="Recent Attendance"
        subtitle="Latest recorded check-ins"
        icon="time-outline"
      />

      {dashboard?.recentAttendance?.length ? (
        <View style={styles.activityList}>
          {dashboard.recentAttendance.map((record, index) => (
            <View
              key={record.id}
              style={[
                styles.activityCard,
                index === dashboard.recentAttendance.length - 1 &&
                  styles.lastActivityCard,
              ]}
            >
              <View style={styles.activityIcon}>
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={COLORS.success}
                />
              </View>

              <View style={styles.activityBody}>
                <Text style={styles.activityTitle} numberOfLines={1}>
                  {record.student_name ||
                    record.student_email ||
                    record.student_id}
                </Text>

                <Text style={styles.activityEvent} numberOfLines={2}>
                  {record.event_title}
                </Text>

                <View style={styles.activityTime}>
                  <Ionicons
                    name="time-outline"
                    size={12}
                    color={COLORS.textSecondary}
                  />
                  <Text style={styles.activityDate}>
                    {formatDate(record.scanned_at)}
                  </Text>
                </View>
              </View>

              <View style={styles.recordBadge}>
                <Text style={styles.recordBadgeText}>RECORDED</Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Ionicons
              name="clipboard-outline"
              size={25}
              color={COLORS.primary}
            />
          </View>

          <Text style={styles.emptyTitle}>
            No attendance records yet
          </Text>

          <Text style={styles.emptyDescription}>
            Student check-ins will appear here once attendance is recorded.
          </Text>
        </View>
      )}

      {/* FOOTER */}
      <View style={styles.footer}>
        <View style={styles.footerDivider} />

        <View style={styles.footerBrand}>
          <Ionicons
            name="qr-code-outline"
            size={16}
            color={COLORS.primary}
          />
          <Text style={styles.footerText}>
            QR Attendance Management System
          </Text>
        </View>

        <Text style={styles.footerCaption}>
          School event attendance made simple.
        </Text>
      </View>
    </ScrollView>
  );
}

// SECTION HEADING

function SectionHeading({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.sectionHeadingText}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>

      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={20} color={COLORS.primary} />
      </View>
    </View>
  );
}

// STAT CARD

function StatCard({
  icon,
  label,
  value,
  compact,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  compact: boolean;
}) {
  return (
    <View style={[styles.statCard, compact && styles.statCardCompact]}>
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={19} color={COLORS.primary} />
      </View>

      <Text style={styles.statValue}>{value.toLocaleString()}</Text>

      <Text style={styles.statLabel} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

// MANAGEMENT CARD

function ManagementCard({
  icon,
  title,
  description,
  color,
  onPress,
  compact,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  color: string;
  onPress: () => void;
  compact: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${description}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.managementCard,
        compact && styles.managementCardCompact,
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.managementIcon,
          { backgroundColor: `${color}18` },
        ]}
      >
        <Ionicons name={icon} size={22} color={color} />
      </View>

      <Text style={styles.managementTitle} numberOfLines={2}>
        {title}
      </Text>

      <Text style={styles.managementDescription} numberOfLines={3}>
        {description}
      </Text>

      <View style={styles.managementFooter}>
        <Text style={styles.openLabel}>Open</Text>
        <Ionicons name="arrow-forward" size={14} color={color} />
      </View>
    </Pressable>
  );
}

// DATE FORMATTER

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Date unavailable';
  }

  return date.toLocaleString();
}

// STYLES

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  content: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 28,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    padding: 24,
  },

  loadingIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingSpinner: {
    marginTop: 18,
  },

  loadingTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 14,
  },

  muted: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
    textAlign: 'center',
  },

  deniedIcon: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: '#FDECEC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },

  deniedTitle: {
    color: COLORS.textPrimary,
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
  },

  deniedDescription: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 18,
  },

  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 12,
  },

  primaryButtonText: {
    color: COLORS.textOnPrimary,
    fontSize: 12,
    fontWeight: '800',
  },

  // HEADER

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },

  brandIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLORS.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  brandTextContainer: {
    flex: 1,
  },

  brandTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },

  brandSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.1,
    marginTop: 3,
  },

  adminBadge: {
    width: 35,
    height: 35,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // WELCOME

  welcomeCard: {
    backgroundColor: COLORS.textSecondary,
    borderRadius: 20,
    padding: 17,
    marginBottom: 22,
  },

  welcomeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },

  welcomeLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },

  welcomeLabel: {
    color: COLORS.surface,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },

  welcomeTitle: {
    color: COLORS.surface,
    fontSize: 14,
    fontWeight: '500',
  },

  adminName: {
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '800',
    marginTop: 3,
  },

  welcomeDescription: {
    color: COLORS.background,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },

  welcomeFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
    marginTop: 14,
    paddingTop: 10,
  },

  welcomeFooterText: {
    color: COLORS.surface,
    fontSize: 10,
  },

  // ERROR

  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FDECEC',
    borderRadius: 14,
    padding: 12,
    marginBottom: 18,
  },

  errorBody: {
    flex: 1,
  },

  errorTitle: {
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: '800',
  },

  errorText: {
    color: COLORS.danger,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
  },

  retryButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
  },

  retryText: {
    color: COLORS.danger,
    fontSize: 11,
    fontWeight: '800',
  },

  // SECTION HEADINGS

  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 11,
  },

  sectionHeadingText: {
    flex: 1,
  },

  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },

  sectionSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 10,
    marginTop: 3,
  },

  sectionIcon: {
    width: 35,
    height: 35,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  // STATISTICS

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 9,
    marginBottom: 23,
  },

  statCard: {
    width: '31.8%',
    minHeight: 104,
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 15,
    padding: 9,
  },

  statCardCompact: {
    padding: 8,
  },

  statIcon: {
    width: 31,
    height: 31,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  statValue: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 7,
  },

  statLabel: {
    color: COLORS.textSecondary,
    fontSize: 9,
    fontWeight: '600',
    lineHeight: 12,
    marginTop: 3,
  },

  // MANAGEMENT GRID

  managementGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
    marginBottom: 23,
  },

  managementCard: {
    width: '48.5%',
    minHeight: 145,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 12,
  },

  managementCardCompact: {
    padding: 10,
  },

  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },

  managementIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 9,
  },

  managementTitle: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },

  managementDescription: {
    color: COLORS.textSecondary,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 4,
    flex: 1,
  },

  managementFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: COLORS.surface,
    paddingTop: 7,
    marginTop: 8,
  },

  openLabel: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },

  // RECENT ATTENDANCE

  activityList: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 15,
    paddingHorizontal: 10,
  },

  activityCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surface,
    gap: 8,
  },

  lastActivityCard: {
    borderBottomWidth: 0,
  },

  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#E7F4EA',
    alignItems: 'center',
    justifyContent: 'center',
  },

  activityBody: {
    flex: 1,
  },

  activityTitle: {
    color: COLORS.textPrimary,
    fontSize: 11,
    fontWeight: '800',
  },

  activityEvent: {
    color: COLORS.textSecondary,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 3,
  },

  activityTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 5,
  },

  activityDate: {
    color: COLORS.textSecondary,
    fontSize: 9,
    flexShrink: 1,
  },

  recordBadge: {
    backgroundColor: '#E7F4EA',
    paddingHorizontal: 5,
    paddingVertical: 4,
    borderRadius: 7,
    marginTop: 2,
  },

  recordBadgeText: {
    color: COLORS.success,
    fontSize: 7,
    fontWeight: '800',
  },

  emptyCard: {
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 15,
    padding: 20,
    marginBottom: 5,
  },

  emptyIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyTitle: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 10,
    textAlign: 'center',
  },

  emptyDescription: {
    color: COLORS.textSecondary,
    fontSize: 10,
    lineHeight: 16,
    marginTop: 5,
    textAlign: 'center',
  },

  // FOOTER

  footer: {
    alignItems: 'center',
    marginTop: 24,
  },

  footerDivider: {
    width: 38,
    height: 3,
    borderRadius: 3,
    backgroundColor: COLORS.surface,
    marginBottom: 13,
  },

  footerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },

  footerText: {
    color: COLORS.textPrimary,
    fontSize: 9,
    fontWeight: '800',
  },

  footerCaption: {
    color: COLORS.textSecondary,
    fontSize: 9,
    marginTop: 5,
  },
});