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
  createAdminEvent,
  deleteAdminEvent,
  getAdminEvents,
  updateAdminEvent,
  type AdminEvent,
} from '@/lib/admin';

type FormState = {
  event_code: string;
  title: string;
  start_time: string;
  end_time: string;
};

const emptyForm: FormState = {
  event_code: '',
  title: '',
  start_time: '',
  end_time: '',
};

export default function ManageEventsScreen() {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<AdminEvent | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const result = await getAdminEvents();
    if (result.error) {
      Alert.alert('Could not load events', result.error);
    } else {
      setEvents(result.data);
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

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalVisible(true);
  };

  const openEdit = (event: AdminEvent) => {
    setEditing(event);
    setModalVisible(true);
    setForm({
      event_code: event.event_code,
      title: event.title,
      start_time: event.start_time ?? '',
      end_time: event.end_time ?? '',
    });
  };

  const save = async () => {
    const code = form.event_code.trim();
    const title = form.title.trim();

    if (!code || !title) {
      Alert.alert('Missing information', 'Event code and title are required.');
      return;
    }

    if (
      form.start_time.trim() &&
      form.end_time.trim() &&
      new Date(form.end_time).getTime() <= new Date(form.start_time).getTime()
    ) {
      Alert.alert('Invalid time', 'End time must be after start time.');
      return;
    }

    setSaving(true);

    const input = {
      event_code: code,
      title,
      start_time: form.start_time.trim() || null,
      end_time: form.end_time.trim() || null,
    };

    const result = editing
      ? await updateAdminEvent(editing.id, input)
      : await createAdminEvent(input);

    setSaving(false);

    if (result.error) {
      Alert.alert('Could not save event', result.error);
      return;
    }

    setForm(emptyForm);
    setEditing(null);
    setModalVisible(false);
    await load();
  };

  const remove = (event: AdminEvent) => {
    Alert.alert(
      'Delete event?',
      `Deleting "${event.title}" also removes its attendance records because the existing database relationship uses ON DELETE CASCADE.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteAdminEvent(event.id);
            if (result.error) {
              Alert.alert('Could not delete event', result.error);
            } else {
              await load();
            }
          },
        },
      ]
    );
  };

  const filtered = events.filter((event) => {
    const query = search.trim().toLowerCase();
    return (
      !query ||
      event.title.toLowerCase().includes(query) ||
      event.event_code.toLowerCase().includes(query)
    );
  });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.muted}>Loading events...</Text>
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
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Manage Events</Text>
            <Text style={styles.subtitle}>
              Create, edit, review, or delete events using the existing events table.
            </Text>
          </View>
          <Pressable onPress={openCreate} style={styles.addButton}>
            <Ionicons name="add" size={24} color={COLORS.textOnPrimary} />
          </Pressable>
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={20} color={COLORS.textSecondary} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search events"
            placeholderTextColor={COLORS.textSecondary}
            style={styles.searchInput}
          />
        </View>

        <Text style={styles.count}>{filtered.length} event(s)</Text>

        {filtered.map((event) => (
          <View key={event.id} style={styles.card}>
            <View style={styles.eventIcon}>
              <Ionicons name="calendar-outline" size={22} color={COLORS.primary} />
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.eventTitle}>{event.title}</Text>
              <Text style={styles.code}>{event.event_code}</Text>
              <Text style={styles.time}>
                {formatRange(event.start_time, event.end_time)}
              </Text>
            </View>
            <View style={styles.actions}>
              <Pressable onPress={() => openEdit(event)} style={styles.iconButton}>
                <Ionicons name="create-outline" size={19} color={COLORS.primary} />
              </Pressable>
              <Pressable onPress={() => remove(event)} style={styles.iconButton}>
                <Ionicons name="trash-outline" size={19} color={COLORS.danger} />
              </Pressable>
            </View>
          </View>
        ))}

        {!filtered.length && <Text style={styles.muted}>No events found.</Text>}
      </ScrollView>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setEditing(null);
          setForm(emptyForm);
          setModalVisible(false);
        }}
      >
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editing ? 'Edit Event' : 'Create Event'}</Text>
              <Pressable
                onPress={() => {
                  setEditing(null);
                  setForm(emptyForm);
                  setModalVisible(false);
                }}
              >
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </Pressable>
            </View>

            <Field
              label="Event Code"
              value={form.event_code}
              onChangeText={(value) => setForm((old) => ({ ...old, event_code: value }))}
              placeholder="EVT-2026-0001"
            />
            <Field
              label="Title"
              value={form.title}
              onChangeText={(value) => setForm((old) => ({ ...old, title: value }))}
              placeholder="School Assembly"
            />
            <Field
              label="Start Time (optional)"
              value={form.start_time}
              onChangeText={(value) => setForm((old) => ({ ...old, start_time: value }))}
              placeholder="2026-10-11T09:00:00"
            />
            <Field
              label="End Time (optional)"
              value={form.end_time}
              onChangeText={(value) => setForm((old) => ({ ...old, end_time: value }))}
              placeholder="2026-10-11T10:00:00"
            />

            <Text style={styles.hint}>
              Use an ISO date/time value such as 2026-10-11T09:00:00. Leave times blank if the event has no schedule.
            </Text>

            <Pressable
              onPress={save}
              disabled={saving}
              style={[styles.saveButton, saving && styles.disabled]}
            >
              {saving ? (
                <ActivityIndicator color={COLORS.textOnPrimary} />
              ) : (
                <Text style={styles.saveText}>{editing ? 'Save Changes' : 'Create Event'}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
}) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textSecondary}
        style={styles.input}
        autoCapitalize="none"
      />
    </View>
  );
}

function formatRange(start: string | null, end: string | null) {
  if (!start && !end) return 'No schedule';
  const startText = start ? new Date(start).toLocaleString() : 'No start';
  const endText = end ? new Date(end).toLocaleString() : 'No end';
  return `${startText} → ${endText}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  muted: { color: COLORS.textSecondary, marginTop: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  title: { color: COLORS.textPrimary, fontSize: 24, fontWeight: '800' },
  subtitle: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 4 },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
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
  count: { color: COLORS.textSecondary, fontSize: 12, marginVertical: 10 },
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 9,
  },
  eventIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  cardBody: { flex: 1 },
  eventTitle: { color: COLORS.textPrimary, fontWeight: '700', fontSize: 14 },
  code: { color: COLORS.primary, fontSize: 12, fontWeight: '700', marginTop: 2 },
  time: { color: COLORS.textSecondary, fontSize: 11, lineHeight: 15, marginTop: 4 },
  actions: { marginLeft: 8 },
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
  label: { color: COLORS.textPrimary, fontWeight: '700', fontSize: 13, marginTop: 14, marginBottom: 6 },
  input: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: COLORS.textPrimary,
  },
  hint: { color: COLORS.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 12 },
  saveButton: { backgroundColor: COLORS.primary, borderRadius: 12, alignItems: 'center', paddingVertical: 13, marginTop: 16 },
  saveText: { color: COLORS.textOnPrimary, fontWeight: '800' },
  disabled: { opacity: 0.6 },
});
