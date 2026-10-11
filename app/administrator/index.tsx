import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
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

  const [dashboard, setDashboard] =
    useState<AdminDashboard | null>(null);

  const [adminName, setAdminName] =
    useState('Administrator');

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!user) return;

    setError(null);

    const [dashboardResult, profile] =
      await Promise.all([
        getAdminDashboard(),
        getProfile(user.id),
      ]);

    if (dashboardResult.error) {
      setError(dashboardResult.error);
    } else {
      setDashboard(dashboardResult.data);
    }

    setAdminName(
      profile?.full_name || 'Administrator'
    );

    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [loadDashboard])
  );

  const refresh = async () => {
    setRefreshing(true);

    await loadDashboard();

    setRefreshing(false);
  };

  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
        />

        <Text style={styles.muted}>
          Loading administrator dashboard...
        </Text>
      </View>
    );
  }

  // ============================================================
  // DASHBOARD
  // ============================================================

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* ======================================================
          HEADER
          ====================================================== */}

      <Text style={styles.eyebrow}>
        Administrator
      </Text>

      <Text style={styles.title}>
        Welcome, {adminName}
      </Text>

      <Text style={styles.subtitle}>
        Manage users, events, attendance, teacher
        verification, and system records from one place.
      </Text>

      {/* ======================================================
          ERROR
          ====================================================== */}

      {error && (
        <Text style={styles.error}>
          {error}
        </Text>
      )}

      {/* ======================================================
          STATISTICS
          ====================================================== */}

      <View style={styles.grid}>
        <StatCard
          icon="people-outline"
          label="Users"
          value={dashboard?.userCount ?? 0}
        />

        <StatCard
          icon="school-outline"
          label="Students"
          value={dashboard?.studentCount ?? 0}
        />

        <StatCard
          icon="briefcase-outline"
          label="Teachers"
          value={dashboard?.teacherCount ?? 0}
        />

        <StatCard
          icon="shield-checkmark-outline"
          label="Admins"
          value={dashboard?.administratorCount ?? 0}
        />

        <StatCard
          icon="calendar-outline"
          label="Events"
          value={dashboard?.eventCount ?? 0}
        />

        <StatCard
          icon="checkmark-circle-outline"
          label="Attendance"
          value={dashboard?.attendanceCount ?? 0}
        />
      </View>

      {/* ======================================================
          QUICK ACTIONS
          ====================================================== */}

      <Text style={styles.sectionTitle}>
        Quick Actions
      </Text>

      <ActionCard
        icon="people-outline"
        title="Manage Users"
        description="View users and update names or roles."
        onPress={() =>
          router.push('/administrator/users')
        }
      />

      <ActionCard
        icon="person-add-outline"
        title="Teacher Verification"
        description="Review and approve or reject teacher requests."
        onPress={() =>
          router.push('/administrator/teacher-requests')
        }
      />

      <ActionCard
        icon="calendar-outline"
        title="Manage Events"
        description="Create, edit, review, or delete events."
        onPress={() =>
          router.push('/administrator/events')
        }
      />

      <ActionCard
        icon="create-outline"
        title="Correct Attendance"
        description="Review and correct attendance timestamps."
        onPress={() =>
          router.push('/administrator/attendance')
        }
      />

      <ActionCard
        icon="bar-chart-outline"
        title="Reports & Records"
        description="Review system summaries and recent activity."
        onPress={() =>
          router.push('/administrator/reports')
        }
      />

      {/* ======================================================
          RECENT ATTENDANCE
          ====================================================== */}

      <Text style={styles.sectionTitle}>
        Recent Attendance
      </Text>

      {dashboard?.recentAttendance.length ? (
        dashboard.recentAttendance.map((record) => (
          <View
            key={record.id}
            style={styles.activityCard}
          >
            <View style={styles.activityIcon}>
              <Ionicons
                name="checkmark"
                size={18}
                color={COLORS.success}
              />
            </View>

            <View style={styles.activityBody}>
              <Text style={styles.activityTitle}>
                {record.student_name ||
                  record.student_email ||
                  record.student_id}
              </Text>

              <Text style={styles.activityText}>
                {record.event_title} ·{' '}
                {formatDate(record.scanned_at)}
              </Text>
            </View>
          </View>
        ))
      ) : (
        <Text style={styles.muted}>
          No attendance records yet.
        </Text>
      )}
    </ScrollView>
  );
}

// ============================================================
// STAT CARD
// ============================================================

function StatCard({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
}) {
  return (
    <View style={styles.statCard}>
      <Ionicons
        name={icon}
        size={22}
        color={COLORS.primary}
      />

      <Text style={styles.statValue}>
        {value}
      </Text>

      <Text style={styles.statLabel}>
        {label}
      </Text>
    </View>
  );
}

// ============================================================
// ACTION CARD
// ============================================================

function ActionCard({
  icon,
  title,
  description,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionCard,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.actionIcon}>
        <Ionicons
          name={icon}
          size={22}
          color={COLORS.primary}
        />
      </View>

      <View style={styles.actionBody}>
        <Text style={styles.actionTitle}>
          {title}
        </Text>

        <Text style={styles.actionDescription}>
          {description}
        </Text>
      </View>

      <Ionicons
        name="chevron-forward"
        size={20}
        color={COLORS.textSecondary}
      />
    </Pressable>
  );
}

// ============================================================
// FORMAT DATE
// ============================================================

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  content: {
    padding: 20,
    paddingBottom: 40,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    padding: 24,
  },

  muted: {
    color: COLORS.textSecondary,
    marginTop: 6,
  },

  eyebrow: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  title: {
    color: COLORS.textPrimary,
    fontSize: 27,
    fontWeight: '800',
    marginTop: 4,
  },

  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 18,
  },

  error: {
    color: COLORS.danger,
    backgroundColor: '#FDECEC',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },

  // ==========================================================
  // STATISTICS
  // ==========================================================

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },

  statCard: {
    width: '31.8%',
    minWidth: 95,
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 13,
  },

  statValue: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 7,
  },

  statLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },

  // ==========================================================
  // SECTION
  // ==========================================================

  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 24,
    marginBottom: 10,
  },

  // ==========================================================
  // ACTION CARDS
  // ==========================================================

  actionCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },

  pressed: {
    opacity: 0.75,
  },

  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  actionBody: {
    flex: 1,
  },

  actionTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },

  actionDescription: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },

  // ==========================================================
  // RECENT ATTENDANCE
  // ==========================================================

  activityCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },

  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E7F4EA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  activityBody: {
    flex: 1,
  },

  activityTitle: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 14,
  },

  activityText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 3,
  },
});