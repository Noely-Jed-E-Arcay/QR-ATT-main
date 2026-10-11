import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { COLORS } from '@/constants/colors';
import { getAdminDashboard, type AdminDashboard } from '@/lib/admin';

export default function ReportsScreen() {
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await getAdminDashboard();

    if (result.error) {
      setError(result.error);
    } else {
      setError(null);
      setData(result.data);
    }

    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.muted}>Loading reports...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} />
      }
    >
      <Text style={styles.title}>Reports & Records</Text>
      <Text style={styles.subtitle}>
        A simple in-app summary based on the existing users, events, and attendance records.
      </Text>

      {error && <Text style={styles.error}>{error}</Text>}

      <ReportRow icon="people-outline" label="Total Users" value={data?.userCount ?? 0} />
      <ReportRow icon="school-outline" label="Students" value={data?.studentCount ?? 0} />
      <ReportRow icon="briefcase-outline" label="Teachers" value={data?.teacherCount ?? 0} />
      <ReportRow icon="shield-checkmark-outline" label="Administrators" value={data?.administratorCount ?? 0} />
      <ReportRow icon="calendar-outline" label="Total Events" value={data?.eventCount ?? 0} />
      <ReportRow icon="checkmark-circle-outline" label="Attendance Records" value={data?.attendanceCount ?? 0} />

      <Text style={styles.sectionTitle}>Recent Activity</Text>

      {data?.recentAttendance.length ? (
        data.recentAttendance.map((item) => (
          <View key={item.id} style={styles.activity}>
            <Ionicons name="checkmark-done-outline" size={20} color={COLORS.success} />
            <View style={styles.activityBody}>
              <Text style={styles.activityTitle}>
                {item.student_name || item.student_email || item.student_id}
              </Text>
              <Text style={styles.activityText}>
                Recorded attendance for {item.event_title}
              </Text>
              <Text style={styles.activityDate}>
                {new Date(item.scanned_at).toLocaleString()}
              </Text>
            </View>
          </View>
        ))
      ) : (
        <Text style={styles.muted}>No recent attendance activity.</Text>
      )}

      <Text style={styles.disclaimer}>
        This report is intentionally in-app and lightweight. The current data model does not contain attendance status, enrollment/expected-attendee data, or an audit-log table, so absent-rate and historical admin-action reports are not calculated.
      </Text>
    </ScrollView>
  );
}

function ReportRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.iconBox}>
        <Ionicons name={icon} size={21} color={COLORS.primary} />
      </View>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  muted: { color: COLORS.textSecondary, marginTop: 8 },
  title: { color: COLORS.textPrimary, fontSize: 24, fontWeight: '800' },
  subtitle: { color: COLORS.textSecondary, lineHeight: 20, marginTop: 5, marginBottom: 15 },
  error: { color: COLORS.danger, marginBottom: 10 },
  row: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 9,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  label: { flex: 1, color: COLORS.textPrimary, fontSize: 14, fontWeight: '600' },
  value: { color: COLORS.primary, fontSize: 22, fontWeight: '800' },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700', marginTop: 22, marginBottom: 9 },
  activity: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    marginBottom: 8,
  },
  activityBody: { flex: 1, marginLeft: 9 },
  activityTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700' },
  activityText: { color: COLORS.textSecondary, fontSize: 12, marginTop: 3 },
  activityDate: { color: COLORS.textSecondary, fontSize: 11, marginTop: 3 },
  disclaimer: {
    color: COLORS.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 10,
    marginTop: 14,
  },
});
