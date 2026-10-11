import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { COLORS } from '@/constants/colors';
import {
  deleteAttendanceRecord,
  getAdminAttendance,
  updateAttendanceRecord,
  type AdminAttendance,
} from '@/lib/admin';

export default function AttendanceRecordsScreen() {
  const [records, setRecords] = useState<AdminAttendance[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<AdminAttendance | null>(null);
  const [scannedAt, setScannedAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const result = await getAdminAttendance();

    if (result.error) {
      Alert.alert('Could not load attendance', result.error);
    } else {
      setRecords(result.data);
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

  const filtered = records.filter((record) => {
    const query = search.trim().toLowerCase();

    return (
      !query ||
      (record.student_name ?? '').toLowerCase().includes(query) ||
      (record.student_email ?? '').toLowerCase().includes(query) ||
      record.student_id.toLowerCase().includes(query) ||
      record.event_title.toLowerCase().includes(query) ||
      record.event_code.toLowerCase().includes(query)
    );
  });

  const openEditor = (record: AdminAttendance) => {
    setSelected(record);
    setScannedAt(record.scanned_at);
  };

  const save = async () => {
    if (!selected) return;

    const parsed = new Date(scannedAt);

    if (Number.isNaN(parsed.getTime())) {
      Alert.alert('Invalid date', 'Enter a valid date/time, such as 2026-10-11T09:30:00.');
      return;
    }

    setSaving(true);
    const result = await updateAttendanceRecord(
      selected.id,
      parsed.toISOString()
    );
    setSaving(false);

    if (result.error) {
      Alert.alert('Could not correct record', result.error);
      return;
    }

    setSelected(null);
    await load();
  };

  const remove = (record: AdminAttendance) => {
    Alert.alert(
      'Delete attendance record?',
      `Remove ${record.student_name || record.student_email || 'this student'} from ${record.event_title}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteAttendanceRecord(record.id);

            if (result.error) {
              Alert.alert('Could not delete record', result.error);
            } else {
              await load();
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.muted}>Loading attendance records...</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }
      >
        <Text style={styles.title}>Attendance Records</Text>
        <Text style={styles.subtitle}>
          Search, correct timestamps, or remove an attendance record when necessary.
        </Text>

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={20} color={COLORS.textSecondary} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Student, event, email, or code"
            placeholderTextColor={COLORS.textSecondary}
            style={styles.searchInput}
          />
        </View>

        <Text style={styles.note}>
          The current schema records attendance as one scan per student per event. It does not contain an explicit Present/Absent status field, so this screen corrects the existing scan timestamp or deletes the record.
        </Text>

        <Text style={styles.count}>{filtered.length} record(s)</Text>

        {filtered.map((record) => (
          <View key={record.id} style={styles.card}>
            <View style={styles.checkIcon}>
              <Ionicons name="checkmark" size={19} color={COLORS.success} />
            </View>

            <View style={styles.body}>
              <Text style={styles.student}>
                {record.student_name || record.student_email || record.student_id}
              </Text>
              <Text style={styles.event}>{record.event_title}</Text>
              <Text style={styles.code}>{record.event_code}</Text>
              <Text style={styles.time}>{formatDate(record.scanned_at)}</Text>
            </View>

            <View style={styles.actions}>
              <Pressable onPress={() => openEditor(record)} style={styles.iconButton}>
                <Ionicons name="create-outline" size={19} color={COLORS.primary} />
              </Pressable>
              <Pressable onPress={() => remove(record)} style={styles.iconButton}>
                <Ionicons name="trash-outline" size={19} color={COLORS.danger} />
              </Pressable>
            </View>
          </View>
        ))}

        {!filtered.length && <Text style={styles.muted}>No records found.</Text>}
      </ScrollView>

      <Modal
        visible={Boolean(selected)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Correct Attendance</Text>
              <Pressable onPress={() => setSelected(null)}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </Pressable>
            </View>

            <Text style={styles.modalStudent}>
              {selected?.student_name || selected?.student_email || selected?.student_id}
            </Text>
            <Text style={styles.modalEvent}>{selected?.event_title}</Text>

            <Text style={styles.label}>Recorded Date/Time</Text>
            <TextInput
              value={scannedAt}
              onChangeText={setScannedAt}
              style={styles.input}
              placeholder="2026-10-11T09:30:00"
              placeholderTextColor={COLORS.textSecondary}
              autoCapitalize="none"
            />

            <Text style={styles.hint}>
              Enter a valid date/time. It will be stored as an ISO timestamp.
            </Text>

            <Pressable
              onPress={save}
              disabled={saving}
              style={[styles.saveButton, saving && styles.disabled]}
            >
              {saving ? (
                <ActivityIndicator color={COLORS.textOnPrimary} />
              ) : (
                <Text style={styles.saveText}>Save Correction</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  muted: { color: COLORS.textSecondary, marginTop: 8 },
  title: { color: COLORS.textPrimary, fontSize: 24, fontWeight: '800' },
  subtitle: { color: COLORS.textSecondary, lineHeight: 20, marginTop: 5, marginBottom: 14 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, color: COLORS.textPrimary, paddingVertical: 12, marginLeft: 8 },
  note: {
    color: COLORS.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  count: { color: COLORS.textSecondary, fontSize: 12, marginVertical: 10 },
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 9,
  },
  checkIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E7F4EA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  body: { flex: 1 },
  student: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700' },
  event: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  code: { color: COLORS.primary, fontSize: 11, fontWeight: '700', marginTop: 2 },
  time: { color: COLORS.textSecondary, fontSize: 11, marginTop: 4 },
  actions: { marginLeft: 5 },
  iconButton: { padding: 7 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  modal: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
    paddingBottom: 28,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '800' },
  modalStudent: { color: COLORS.textPrimary, fontWeight: '700', marginTop: 16 },
  modalEvent: { color: COLORS.textSecondary, marginTop: 3 },
  label: { color: COLORS.textPrimary, fontWeight: '700', fontSize: 13, marginTop: 18, marginBottom: 6 },
  input: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: COLORS.textPrimary,
  },
  hint: { color: COLORS.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 8 },
  saveButton: { backgroundColor: COLORS.primary, borderRadius: 12, alignItems: 'center', paddingVertical: 13, marginTop: 16 },
  saveText: { color: COLORS.textOnPrimary, fontWeight: '800' },
  disabled: { opacity: 0.6 },
});
