
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
  setAdminEventStatus,
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
  const [changingStatusId, setChangingStatusId] = useState<string | null>(null);

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
    setForm({
      event_code: event.event_code,
      title: event.title,
      start_time: event.start_time ?? '',
      end_time: event.end_time ?? '',
    });
    setModalVisible(true);
  };

  const closeModal = () => {
    if (saving) return;

    setEditing(null);
    setForm(emptyForm);
    setModalVisible(false);
  };

  const save = async () => {
    const code = form.event_code.trim();
    const title = form.title.trim();
    const startTime = form.start_time.trim();
    const endTime = form.end_time.trim();

    if (!code || !title) {
      Alert.alert('Missing information', 'Event code and title are required.');
      return;
    }

    if (
      startTime &&
      !Number.isFinite(new Date(startTime).getTime())
    ) {
      Alert.alert('Invalid time', 'Enter a valid event start date and time.');
      return;
    }

    if (
      endTime &&
      !Number.isFinite(new Date(endTime).getTime())
    ) {
      Alert.alert('Invalid time', 'Enter a valid event end date and time.');
      return;
    }

    if (
      startTime &&
      endTime &&
      new Date(endTime).getTime() <= new Date(startTime).getTime()
    ) {
      Alert.alert('Invalid time', 'End time must be after the start time.');
      return;
    }

    setSaving(true);

    try {
      const input = {
        event_code: code,
        title,
        start_time: startTime || null,
        end_time: endTime || null,
      };

      const result = editing
        ? await updateAdminEvent(editing.id, input)
        : await createAdminEvent(input);

      if (result.error) {
        Alert.alert('Could not save event', result.error);
        return;
      }

      setForm(emptyForm);
      setEditing(null);
      setModalVisible(false);
      await load();
    } catch (error) {
      Alert.alert(
        'Could not save event',
        error instanceof Error ? error.message : 'An unexpected error occurred.'
      );
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = (event: AdminEvent) => {
    const closing = event.status !== 'closed';
    const nextStatus = closing ? 'closed' : 'open';

    Alert.alert(
      closing ? 'Close event?' : 'Reopen event?',
      closing
        ? `Close "${event.title}"? Students will no longer be able to register new attendance. Existing attendance records will remain.`
        : `Reopen "${event.title}"? Students may register attendance again if the event schedule permits it.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: closing ? 'Close Event' : 'Reopen Event',
          style: closing ? 'destructive' : 'default',
          onPress: async () => {
            setChangingStatusId(event.id);

            try {
              const result = await setAdminEventStatus(event.id, nextStatus);

              if (result.error) {
                Alert.alert('Could not update event status', result.error);
                return;
              }

              await load();
            } catch (error) {
              Alert.alert(
                'Could not update event status',
                error instanceof Error
                  ? error.message
                  : 'An unexpected error occurred.'
              );
            } finally {
              setChangingStatusId(null);
            }
          },
        },
      ]
    );
  };

  const remove = (event: AdminEvent) => {
    Alert.alert(
      'Delete event?',
      `Deleting "${event.title}" also removes its attendance records if your database uses ON DELETE CASCADE. To preserve attendance history, close the event instead.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await deleteAdminEvent(event.id);

              if (result.error) {
                Alert.alert('Could not delete event', result.error);
                return;
              }

              await load();
            } catch (error) {
              Alert.alert(
                'Could not delete event',
                error instanceof Error
                  ? error.message
                  : 'An unexpected error occurred.'
              );
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
      event.event_code.toLowerCase().includes(query) ||
      event.status.toLowerCase().includes(query)
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
          <View style={styles.titleBody}>
            <Text style={styles.title}>Manage Events</Text>
            <Text style={styles.subtitle}>
              Create, edit, close, reopen, or delete events.
            </Text>
          </View>

          <Pressable
            onPress={openCreate}
            style={styles.addButton}
            accessibilityRole="button"
            accessibilityLabel="Create event"
          >
            <Ionicons name="add" size={24} color={COLORS.textOnPrimary} />
          </Pressable>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>{events.length}</Text>
            <Text style={styles.summaryLabel}>Total</Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>
              {events.filter((event) => event.status === 'open').length}
            </Text>
            <Text style={styles.summaryLabel}>Open</Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>
              {events.filter((event) => event.status === 'closed').length}
            </Text>
            <Text style={styles.summaryLabel}>Closed</Text>
          </View>
        </View>

        <View style={styles.searchBox}>
          <Ionicons
            name="search-outline"
            size={20}
            color={COLORS.textSecondary}
          />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search title, code, or status"
            placeholderTextColor={COLORS.textSecondary}
            style={styles.searchInput}
            autoCapitalize="none"
          />
          {!!search && (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons
                name="close-circle"
                size={19}
                color={COLORS.textSecondary}
              />
            </Pressable>
          )}
        </View>

        <Text style={styles.count}>
          {filtered.length} event(s) found
        </Text>

        {filtered.map((event) => {
          const isClosed = event.status === 'closed';
          const changing = changingStatusId === event.id;

          return (
            <View key={event.id} style={styles.card}>
              <View
                style={[
                  styles.eventIcon,
                  isClosed && styles.closedIcon,
                ]}
              >
                <Ionicons
                  name={isClosed ? 'lock-closed-outline' : 'calendar-outline'}
                  size={22}
                  color={isClosed ? COLORS.danger : COLORS.primary}
                />
              </View>

              <View style={styles.cardBody}>
                <View style={styles.eventHeading}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      isClosed ? styles.closedBadge : styles.openBadge,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        isClosed ? styles.closedText : styles.openText,
                      ]}
                    >
                      {isClosed ? 'CLOSED' : 'OPEN'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.code}>{event.event_code}</Text>
                <Text style={styles.time}>
                  {formatRange(event.start_time, event.end_time)}
                </Text>

                <View style={styles.cardActions}>
                  <Pressable
                    onPress={() => changeStatus(event)}
                    disabled={changing}
                    style={[
                      styles.statusButton,
                      isClosed ? styles.reopenButton : styles.closeButton,
                      changing && styles.disabled,
                    ]}
                  >
                    {changing ? (
                      <ActivityIndicator
                        size="small"
                        color={COLORS.textOnPrimary}
                      />
                    ) : (
                      <>
                        <Ionicons
                          name={isClosed ? 'lock-open-outline' : 'lock-closed-outline'}
                          size={15}
                          color={COLORS.textOnPrimary}
                        />
                        <Text style={styles.statusButtonText}>
                          {isClosed ? 'Reopen' : 'Close Event'}
                        </Text>
                      </>
                    )}
                  </Pressable>

                  <Pressable
                    onPress={() => openEdit(event)}
                    style={styles.iconButton}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${event.title}`}
                  >
                    <Ionicons
                      name="create-outline"
                      size={19}
                      color={COLORS.primary}
                    />
                  </Pressable>

                  <Pressable
                    onPress={() => remove(event)}
                    style={styles.iconButton}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${event.title}`}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={19}
                      color={COLORS.danger}
                    />
                  </Pressable>
                </View>
              </View>
            </View>
          );
        })}

        {!filtered.length && (
          <View style={styles.emptyState}>
            <Ionicons
              name="calendar-outline"
              size={34}
              color={COLORS.textSecondary}
            />
            <Text style={styles.emptyTitle}>No events found</Text>
            <Text style={styles.muted}>
              Try another search or create a new event.
            </Text>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleBody}>
                <Text style={styles.modalTitle}>
                  {editing ? 'Edit Event' : 'Create Event'}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {editing
                    ? 'Update the event details below.'
                    : 'Enter the new event details below.'}
                </Text>
              </View>

              <Pressable
                onPress={closeModal}
                disabled={saving}
                hitSlop={8}
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={COLORS.textPrimary}
                />
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Field
                label="Event Code"
                value={form.event_code}
                onChangeText={(value) =>
                  setForm((old) => ({ ...old, event_code: value }))
                }
                placeholder="EVT-2026-0001"
              />

              <Field
                label="Title"
                value={form.title}
                onChangeText={(value) =>
                  setForm((old) => ({ ...old, title: value }))
                }
                placeholder="School Assembly"
              />

              <Field
                label="Start Time (optional)"
                value={form.start_time}
                onChangeText={(value) =>
                  setForm((old) => ({ ...old, start_time: value }))
                }
                placeholder="2026-10-11T09:00:00+08:00"
              />

              <Field
                label="End Time (optional)"
                value={form.end_time}
                onChangeText={(value) =>
                  setForm((old) => ({ ...old, end_time: value }))
                }
                placeholder="2026-10-11T10:00:00+08:00"
              />

              <Text style={styles.hint}>
                Use an ISO date/time value. Include +08:00 for Philippine
                local time when appropriate. Leave both fields blank if the
                event has no schedule.
              </Text>

              {editing?.status === 'closed' && (
                <View style={styles.modalNotice}>
                  <Ionicons
                    name="information-circle-outline"
                    size={18}
                    color={COLORS.danger}
                  />
                  <Text style={styles.modalNoticeText}>
                    This event is closed. Editing its details will not reopen it.
                  </Text>
                </View>
              )}

              <Pressable
                onPress={save}
                disabled={saving}
                style={[
                  styles.saveButton,
                  saving && styles.disabled,
                ]}
              >
                {saving ? (
                  <ActivityIndicator color={COLORS.textOnPrimary} />
                ) : (
                  <Text style={styles.saveText}>
                    {editing ? 'Save Changes' : 'Create Event'}
                  </Text>
                )}
              </Pressable>
            </ScrollView>
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

  const startDate = start ? new Date(start) : null;
  const endDate = end ? new Date(end) : null;

  const startText =
    startDate && Number.isFinite(startDate.getTime())
      ? startDate.toLocaleString()
      : start
        ? 'Invalid start time'
        : 'No start';

  const endText =
    endDate && Number.isFinite(endDate.getTime())
      ? endDate.toLocaleString()
      : end
        ? 'Invalid end time'
        : 'No end';

  return `${startText} → ${endText}`;
}

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
  },
  muted: {
    color: COLORS.textSecondary,
    marginTop: 8,
    fontSize: 12,
    lineHeight: 17,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleBody: {
    flex: 1,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 9,
    marginBottom: 14,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
  },
  summaryNumber: {
    color: COLORS.textPrimary,
    fontSize: 21,
    fontWeight: '800',
  },
  summaryLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 3,
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
  searchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    paddingVertical: 12,
    marginLeft: 8,
  },
  count: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginVertical: 12,
  },
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
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
  closedIcon: {
    opacity: 0.8,
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
  },
  eventHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 7,
  },
  eventTitle: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 14,
    flex: 1,
  },
  statusBadge: {
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  openBadge: {
    backgroundColor: '#E2F5E9',
  },
  closedBadge: {
    backgroundColor: '#FCE8E6',
  },
  statusText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  openText: {
    color: '#216E43',
  },
  closedText: {
    color: '#A12622',
  },
  code: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  time: {
    color: COLORS.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 5,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  statusButton: {
    minHeight: 34,
    borderRadius: 9,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  closeButton: {
    backgroundColor: COLORS.danger,
  },
  reopenButton: {
    backgroundColor: COLORS.primary,
  },
  statusButtonText: {
    color: COLORS.textOnPrimary,
    fontSize: 11,
    fontWeight: '800',
  },
  iconButton: {
    minWidth: 34,
    minHeight: 34,
    borderRadius: 9,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 10,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  modal: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
    paddingBottom: 28,
    maxHeight: '92%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalTitleBody: {
    flex: 1,
  },
  modalTitle: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  modalSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  label: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 13,
    marginTop: 14,
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: COLORS.textPrimary,
  },
  hint: {
    color: COLORS.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 12,
  },
  modalNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FCE8E6',
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
  },
  modalNoticeText: {
    flex: 1,
    color: '#A12622',
    fontSize: 12,
    lineHeight: 17,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 13,
    marginTop: 16,
  },
  saveText: {
    color: COLORS.textOnPrimary,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.6,
  },
});
