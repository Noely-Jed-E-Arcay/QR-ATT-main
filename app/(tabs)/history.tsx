
import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import {
  getAttendanceHistory,
  getTeacherEventAttendance,
  type AttendanceRecord,
  type TeacherEventAttendance,
} from '@/lib/attendance';
import {
  deleteEvent,
  getEventsByTeacher,
  updateEvent,
} from '@/lib/events';
import { getProfile, type Role } from '@/lib/profiles';
import { buildQRPayload } from '@/lib/qr';

type HistoryEvent = TeacherEventAttendance & {
  createdAt: string | null;
  location: string | null;
  description: string | null;
};

type EventGroup = {
  key: string;
  events: HistoryEvent[];
};

type EditPickerType =
  | 'startDate'
  | 'startTime'
  | 'endDate'
  | 'endTime'
  | null;

export default function HistoryScreen() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<Role | null>(null);
  const [studentRecords, setStudentRecords] = useState<AttendanceRecord[]>([]);
  const [teacherEvents, setTeacherEvents] = useState<HistoryEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [attendeeEvent, setAttendeeEvent] = useState<HistoryEvent | null>(null);
  const [qrEvent, setQrEvent] = useState<HistoryEvent | null>(null);
  const [editingEvent, setEditingEvent] = useState<HistoryEvent | null>(null);

  const [editTitle, setEditTitle] = useState('');
  const [editStartDate, setEditStartDate] = useState<Date | null>(null);
  const [editEndDate, setEditEndDate] = useState<Date | null>(null);
  const [editLocation, setEditLocation] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [activeEditPicker, setActiveEditPicker] =
    useState<EditPickerType>(null);

  const [savingEvent, setSavingEvent] = useState(false);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setRole(null);
      setTeacherEvents([]);
      setStudentRecords([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const profile = await getProfile(user.id);
      const currentRole = profile?.role ?? 'student';

      setRole(currentRole);

      if (currentRole === 'teacher' || currentRole === 'admin') {
        const [attendance, eventsResult] = await Promise.all([
          getTeacherEventAttendance(user.id),
          getEventsByTeacher(),
        ]);

        if (eventsResult.error) {
          throw new Error(eventsResult.error);
        }

        const metadata = new Map(
          eventsResult.events.map((event) => [
            event.id,
            {
              createdAt: event.created_at ?? null,
              location: event.location ?? null,
              description: event.description ?? null,
            },
          ])
        );

        const merged: HistoryEvent[] = attendance.map((event) => {
          const attendanceData = event as TeacherEventAttendance & {
            location?: string | null;
            description?: string | null;
          };

          const eventMetadata = metadata.get(event.eventId);

          return {
            ...event,
            createdAt: eventMetadata?.createdAt ?? null,
            location:
              attendanceData.location ?? eventMetadata?.location ?? null,
            description:
              attendanceData.description ??
              eventMetadata?.description ??
              null,
          };
        });

        merged.sort(
          (a, b) =>
            new Date(b.createdAt ?? 0).getTime() -
            new Date(a.createdAt ?? 0).getTime()
        );

        setTeacherEvents(merged);
        setStudentRecords([]);
      } else {
        const records = await getAttendanceHistory(user.id);
        setStudentRecords(records);
        setTeacherEvents([]);
      }
    } catch (error) {
      console.error('Failed to load history:', error);
      Alert.alert(
        'Loading Failed',
        error instanceof Error
          ? error.message
          : 'Unable to load attendance history.'
      );
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const eventGroups = useMemo<EventGroup[]>(() => {
    const filtered = selectedDate
      ? teacherEvents.filter(
          (event) => getDateKey(event.startTime) === selectedDate
        )
      : teacherEvents;

    const groups = new Map<string, HistoryEvent[]>();

    filtered.forEach((event) => {
      const key = getDateKey(event.startTime) ?? 'unscheduled';
      groups.set(key, [...(groups.get(key) ?? []), event]);
    });

    return [...groups.entries()]
      .map(([key, events]) => ({
        key,
        events: events.sort(
          (a, b) =>
            new Date(b.createdAt ?? 0).getTime() -
            new Date(a.createdAt ?? 0).getTime()
        ),
      }))
      .sort((a, b) =>
        a.key === 'unscheduled'
          ? 1
          : b.key === 'unscheduled'
            ? -1
            : b.key.localeCompare(a.key)
      );
  }, [teacherEvents, selectedDate]);

  const totalAttendees = teacherEvents.reduce(
    (total, event) => total + event.attendeeCount,
    0
  );

  const handleEditEvent = (event: HistoryEvent) => {
    setEditingEvent(event);
    setEditTitle(event.title);
    setEditStartDate(parseDate(event.startTime));
    setEditEndDate(parseDate(event.endTime));
    setEditLocation(event.location ?? '');
    setEditDescription(event.description ?? '');
    setActiveEditPicker(null);
  };

  const handleEditPickerChange = (
    event: { type: string },
    selected: Date | undefined
  ) => {
    if (Platform.OS !== 'ios') {
      setActiveEditPicker(null);
    }

    if (event.type === 'dismissed' || !selected) {
      return;
    }

    if (activeEditPicker === 'startDate') {
      setEditStartDate((previous) =>
        combineDateAndTime(selected, previous ?? new Date())
      );
    } else if (activeEditPicker === 'startTime') {
      setEditStartDate((previous) =>
        combineDateAndTime(previous ?? new Date(), selected)
      );
    } else if (activeEditPicker === 'endDate') {
      setEditEndDate((previous) =>
        combineDateAndTime(selected, previous ?? new Date())
      );
    } else if (activeEditPicker === 'endTime') {
      setEditEndDate((previous) =>
        combineDateAndTime(previous ?? new Date(), selected)
      );
    }
  };

  // FIXING: Use the correct updateEvent field names.
  const handleSaveEvent = async () => {
    if (!editingEvent || !editTitle.trim()) {
      Alert.alert('Invalid Input', 'Event title is required.');
      return;
    }

    const parsedStart = editStartDate
      ? editStartDate.toISOString()
      : null;

    const parsedEnd = editEndDate
      ? editEndDate.toISOString()
      : null;

    if (
      parsedStart &&
      parsedEnd &&
      new Date(parsedEnd).getTime() <= new Date(parsedStart).getTime()
    ) {
      Alert.alert(
        'Invalid Date or Time',
        'The end date and time must be later than the start date and time.'
      );
      return;
    }

    setSavingEvent(true);

    try {
      const { error } = await updateEvent(editingEvent.eventId, {
        title: editTitle.trim(),
        start_time: parsedStart,
        end_time: parsedEnd,
        location: editLocation.trim() || null,
        description: editDescription.trim() || null,
      });

      if (error) {
        Alert.alert('Update Failed', error);
        return;
      }

      setEditingEvent(null);
      setActiveEditPicker(null);

      await load();

      Alert.alert('Success', 'Event details updated successfully.');
    } catch (error) {
      console.error('Update failed:', error);

      Alert.alert(
        'Update Failed',
        error instanceof Error
          ? error.message
          : 'Unable to update event.'
      );
    } finally {
      setSavingEvent(false);
    }
  };

  const handleDeleteEvent = (event: HistoryEvent) => {
    Alert.alert(
      'Delete Event',
      `Are you sure you want to delete "${event.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingEventId(event.eventId);

            try {
              const { error } = await deleteEvent(event.eventId);

              if (error) {
                Alert.alert('Delete Failed', error);
                return;
              }

              if (attendeeEvent?.eventId === event.eventId) {
                setAttendeeEvent(null);
              }

              if (qrEvent?.eventId === event.eventId) {
                setQrEvent(null);
              }

              if (editingEvent?.eventId === event.eventId) {
                setEditingEvent(null);
              }

              await load();

              Alert.alert('Success', 'Event deleted successfully.');
            } catch (error) {
              console.error('Delete failed:', error);
              Alert.alert('Delete Failed', 'Unable to delete the event.');
            } finally {
              setDeletingEventId(null);
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
        <Text style={styles.muted}>Loading history...</Text>
      </View>
    );
  }

  if (role === 'teacher' || role === 'admin') {
    return (
      <>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.pageHeader}>
            <View>
              <Text style={styles.title}>Attendance History</Text>
              <Text style={styles.subtitle}>Manage your events</Text>
            </View>
            <Ionicons
              name="calendar-outline"
              size={28}
              color={COLORS.primary}
            />
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Ionicons
                name="calendar-outline"
                size={19}
                color={COLORS.primary}
              />
              <View>
                <Text style={styles.summaryValue}>{teacherEvents.length}</Text>
                <Text style={styles.summaryLabel}>Events</Text>
              </View>
            </View>

            <View style={styles.summaryCard}>
              <Ionicons
                name="people-outline"
                size={19}
                color={COLORS.primary}
              />
              <View>
                <Text style={styles.summaryValue}>{totalAttendees}</Text>
                <Text style={styles.summaryLabel}>Attendance</Text>
              </View>
            </View>
          </View>

          <View style={styles.filterCard}>
            <View style={styles.filterHeader}>
              <Ionicons
                name="funnel-outline"
                size={17}
                color={COLORS.primary}
              />
              <Text style={styles.cardTitle}>Filter date</Text>
            </View>

            <View style={styles.filterRow}>
              <Pressable
                style={styles.dateButton}
                onPress={() => setShowDatePicker((value) => !value)}
              >
                <Text style={styles.dateText}>
                  {selectedDate ? readableDate(selectedDate) : 'All dates'}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={17}
                  color={COLORS.textSecondary}
                />
              </Pressable>

              {selectedDate && (
                <Pressable
                  style={styles.clearButton}
                  onPress={() => {
                    setSelectedDate(null);
                    setShowDatePicker(false);
                  }}
                >
                  <Text style={styles.link}>Clear</Text>
                </Pressable>
              )}
            </View>

            {showDatePicker && (
              <DateTimePicker
                value={selectedDate ? dateFromKey(selectedDate) : new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onChange={(event, date) => {
                  if (Platform.OS !== 'ios') setShowDatePicker(false);

                  if (event.type !== 'dismissed' && date) {
                    setSelectedDate(dateKey(date));
                  }
                }}
                themeVariant="light"
              />
            )}

            {showDatePicker && Platform.OS === 'ios' && (
              <Pressable
                style={styles.primaryButton}
                onPress={() => setShowDatePicker(false)}
              >
                <Text style={styles.buttonText}>Done</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.listHeader}>
            <Text style={styles.sectionTitle}>
              {selectedDate ? readableDate(selectedDate) : 'Your Events'}
            </Text>
            <Text style={styles.muted}>
              {eventGroups.reduce(
                (sum, group) => sum + group.events.length,
                0
              )}{' '}
              shown
            </Text>
          </View>

          {teacherEvents.length === 0 ? (
            <Empty
              icon="calendar-clear-outline"
              title="No Events Yet"
              message="Events you create will appear here."
            />
          ) : eventGroups.length === 0 ? (
            <Empty
              icon="search-outline"
              title="No Events Found"
              message="Try another date or clear the filter."
            />
          ) : (
            eventGroups.map((group) => (
              <View key={group.key}>
                {selectedDate === null && (
                  <Text style={styles.groupTitle}>
                    {group.key === 'unscheduled'
                      ? 'No Date'
                      : readableDate(group.key)}
                  </Text>
                )}

                {group.events.map((event) => {
                  const status = getEventStatus(
                    event.startTime,
                    event.endTime
                  );

                  return (
                    <View key={event.eventId} style={styles.eventCard}>
                      <Pressable
                        style={styles.eventMain}
                        onPress={() => setAttendeeEvent(event)}
                      >
                        <View style={styles.eventIcon}>
                          <Ionicons
                            name="calendar"
                            size={20}
                            color={COLORS.primary}
                          />
                        </View>

                        <View style={styles.eventInfo}>
                          <Text style={styles.eventTitle} numberOfLines={2}>
                            {event.title}
                          </Text>

                          <Text style={styles.meta} numberOfLines={1}>
                            Code: {event.eventCode}
                          </Text>

                          <View style={styles.detailRow}>
                            <Ionicons
                              name="play-outline"
                              size={13}
                              color={COLORS.textSecondary}
                            />
                            <Text style={styles.metaDetail}>
                              Start:{' '}
                              {event.startTime
                                ? formatDate(event.startTime)
                                : 'Not set'}
                            </Text>
                          </View>

                          <View style={styles.detailRow}>
                            <Ionicons
                              name="flag-outline"
                              size={13}
                              color={COLORS.textSecondary}
                            />
                            <Text style={styles.metaDetail}>
                              End:{' '}
                              {event.endTime
                                ? formatDate(event.endTime)
                                : 'Not set'}
                            </Text>
                          </View>

                          <View style={styles.detailRow}>
                            <Ionicons
                              name="location-outline"
                              size={13}
                              color={COLORS.textSecondary}
                            />
                            <Text style={styles.metaDetail}>
                              Location:{' '}
                              {event.location?.trim() || 'Not specified'}
                            </Text>
                          </View>

                          <View style={styles.descriptionContainer}>
                            <Text style={styles.descriptionLabel}>
                              Description
                            </Text>
                            <Text style={styles.descriptionText}>
                              {event.description?.trim() ||
                                'No description provided.'}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.eventStats}>
                          <Text style={styles.attendeeCount}>
                            {event.attendeeCount}
                          </Text>
                          <Text style={styles.tinyLabel}>attendees</Text>
                          <Text
                            style={[
                              styles.status,
                              status === 'Upcoming'
                                ? styles.upcoming
                                : status === 'Ongoing'
                                  ? styles.ongoing
                                  : styles.ended,
                            ]}
                          >
                            {status}
                          </Text>
                        </View>
                      </Pressable>

                      <View style={styles.actions}>
                        <ActionButton
                          icon="people-outline"
                          label="Attendees"
                          onPress={() => setAttendeeEvent(event)}
                        />
                        <ActionButton
                          icon="qr-code-outline"
                          label="QR"
                          onPress={() => setQrEvent(event)}
                        />
                        <ActionButton
                          icon="create-outline"
                          label="Edit"
                          onPress={() => handleEditEvent(event)}
                        />
                        <Pressable
                          disabled={deletingEventId === event.eventId}
                          style={[styles.iconAction, styles.deleteAction]}
                          onPress={() => handleDeleteEvent(event)}
                        >
                          {deletingEventId === event.eventId ? (
                            <ActivityIndicator
                              size="small"
                              color={COLORS.danger}
                            />
                          ) : (
                            <Ionicons
                              name="trash-outline"
                              size={17}
                              color={COLORS.danger}
                            />
                          )}
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            ))
          )}
        </ScrollView>

        <Modal
          visible={!!attendeeEvent}
          transparent
          animationType="fade"
          onRequestClose={() => setAttendeeEvent(null)}
        >
          <View style={styles.overlay}>
            <View style={styles.modalCard}>
              <ModalHeader
                title="Attendees"
                subtitle={attendeeEvent?.title ?? ''}
                onClose={() => setAttendeeEvent(null)}
              />

              <Text style={styles.cardTitle}>
                {attendeeEvent?.attendeeCount ?? 0} attendee(s)
              </Text>

              <ScrollView style={styles.attendeeScroll}>
                {attendeeEvent?.attendees.length ? (
                  [...attendeeEvent.attendees]
                    .sort((a, b) =>
                      (a.studentName || a.studentId).localeCompare(
                        b.studentName || b.studentId
                      )
                    )
                    .map((attendee) => (
                      <View
                        key={`${attendeeEvent.eventId}-${attendee.studentId}`}
                        style={styles.attendeeRow}
                      >
                        <View style={styles.attendeeIcon}>
                          <Ionicons
                            name="person-outline"
                            size={17}
                            color={COLORS.primary}
                          />
                        </View>
                        <View style={styles.eventInfo}>
                          <Text style={styles.eventTitle}>
                            {attendee.studentName?.trim() ||
                              `Student ${shortId(attendee.studentId)}`}
                          </Text>
                          <Text style={styles.meta}>
                            {formatDate(attendee.scannedAt)}
                          </Text>
                        </View>
                      </View>
                    ))
                ) : (
                  <Text style={styles.emptyText}>
                    No students have attended this event yet.
                  </Text>
                )}
              </ScrollView>

              <Pressable
                style={styles.primaryButton}
                onPress={() => setAttendeeEvent(null)}
              >
                <Text style={styles.buttonText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <Modal
          visible={!!qrEvent}
          transparent
          animationType="fade"
          onRequestClose={() => setQrEvent(null)}
        >
          <View style={styles.overlay}>
            <View style={styles.modalCard}>
              <ModalHeader
                title="Event QR Code"
                subtitle={qrEvent?.title ?? ''}
                onClose={() => setQrEvent(null)}
              />

              <Text style={styles.modalDescription}>
                Scan this code to record attendance.
              </Text>

              {qrEvent && (
                <View style={styles.qrWrap}>
                  <QRCode
                    value={buildQRPayload({
                      eventId: qrEvent.eventCode,
                      title: qrEvent.title,
                      start: qrEvent.startTime ?? undefined,
                      end: qrEvent.endTime ?? undefined,
                    })}
                    size={180}
                    backgroundColor="#FFFFFF"
                  />
                  <Text style={styles.eventTitle}>{qrEvent.eventCode}</Text>
                </View>
              )}

              <Pressable
                style={styles.primaryButton}
                onPress={() => setQrEvent(null)}
              >
                <Text style={styles.buttonText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <Modal
          visible={!!editingEvent}
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (!savingEvent) {
              setEditingEvent(null);
              setActiveEditPicker(null);
            }
          }}
        >
          <View style={styles.overlay}>
            <View style={styles.modalCard}>
              <ModalHeader
                title="Edit Event"
                subtitle={editingEvent?.eventCode ?? ''}
                onClose={() => {
                  if (!savingEvent) {
                    setEditingEvent(null);
                    setActiveEditPicker(null);
                  }
                }}
              />

              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.inputLabel}>Event title</Text>
                <TextInput
                  style={styles.input}
                  value={editTitle}
                  onChangeText={setEditTitle}
                  placeholder="Event title"
                  placeholderTextColor={COLORS.textSecondary}
                  editable={!savingEvent}
                />

                <Text style={styles.inputLabel}>Event location</Text>
                <TextInput
                  style={styles.input}
                  value={editLocation}
                  onChangeText={setEditLocation}
                  placeholder="Enter event location"
                  placeholderTextColor={COLORS.textSecondary}
                  editable={!savingEvent}
                />

                <Text style={styles.inputLabel}>Event description</Text>
                <TextInput
                  style={[styles.input, styles.multilineInput]}
                  value={editDescription}
                  onChangeText={setEditDescription}
                  placeholder="Describe what this event is about"
                  placeholderTextColor={COLORS.textSecondary}
                  multiline
                  textAlignVertical="top"
                  editable={!savingEvent}
                />

                <Text style={styles.inputLabel}>Start date</Text>
                <Pressable
                  style={styles.pickerButton}
                  disabled={savingEvent}
                  onPress={() =>
                    setActiveEditPicker((current) =>
                      current === 'startDate' ? null : 'startDate'
                    )
                  }
                >
                  <Ionicons
                    name="calendar-outline"
                    size={18}
                    color={COLORS.primary}
                  />
                  <Text style={styles.pickerButtonText}>
                    {editStartDate
                      ? formatPickerDate(editStartDate)
                      : 'Select start date'}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={16}
                    color={COLORS.textSecondary}
                  />
                </Pressable>

                <Text style={styles.inputLabel}>Start time</Text>
                <Pressable
                  style={styles.pickerButton}
                  disabled={savingEvent}
                  onPress={() =>
                    setActiveEditPicker((current) =>
                      current === 'startTime' ? null : 'startTime'
                    )
                  }
                >
                  <Ionicons
                    name="time-outline"
                    size={18}
                    color={COLORS.primary}
                  />
                  <Text style={styles.pickerButtonText}>
                    {editStartDate
                      ? formatPickerTime(editStartDate)
                      : 'Select start time'}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={16}
                    color={COLORS.textSecondary}
                  />
                </Pressable>

                <Text style={styles.inputLabel}>End date</Text>
                <Pressable
                  style={styles.pickerButton}
                  disabled={savingEvent}
                  onPress={() =>
                    setActiveEditPicker((current) =>
                      current === 'endDate' ? null : 'endDate'
                    )
                  }
                >
                  <Ionicons
                    name="calendar-outline"
                    size={18}
                    color={COLORS.primary}
                  />
                  <Text style={styles.pickerButtonText}>
                    {editEndDate
                      ? formatPickerDate(editEndDate)
                      : 'Select end date'}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={16}
                    color={COLORS.textSecondary}
                  />
                </Pressable>

                <Text style={styles.inputLabel}>End time</Text>
                <Pressable
                  style={styles.pickerButton}
                  disabled={savingEvent}
                  onPress={() =>
                    setActiveEditPicker((current) =>
                      current === 'endTime' ? null : 'endTime'
                    )
                  }
                >
                  <Ionicons
                    name="time-outline"
                    size={18}
                    color={COLORS.primary}
                  />
                  <Text style={styles.pickerButtonText}>
                    {editEndDate
                      ? formatPickerTime(editEndDate)
                      : 'Select end time'}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={16}
                    color={COLORS.textSecondary}
                  />
                </Pressable>

                {activeEditPicker && (
                  <View style={styles.pickerContainer}>
                    <DateTimePicker
                      value={
                        activeEditPicker === 'startDate' ||
                        activeEditPicker === 'startTime'
                          ? editStartDate ?? new Date()
                          : editEndDate ?? editStartDate ?? new Date()
                      }
                      mode={
                        activeEditPicker === 'startDate' ||
                        activeEditPicker === 'endDate'
                          ? 'date'
                          : 'time'
                      }
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={handleEditPickerChange}
                      themeVariant="light"
                    />

                    {Platform.OS === 'ios' && (
                      <Pressable
                        style={styles.primaryButton}
                        onPress={() => setActiveEditPicker(null)}
                      >
                        <Text style={styles.buttonText}>Done</Text>
                      </Pressable>
                    )}
                  </View>
                )}

                <Text style={styles.inputHint}>
                  Select a date and time using the buttons above. If the event
                  does not have a start or end scheduled, leave that value
                  unselected.
                </Text>

                <Pressable
                  style={[
                    styles.primaryButton,
                    savingEvent && styles.disabled,
                  ]}
                  disabled={savingEvent}
                  onPress={handleSaveEvent}
                >
                  {savingEvent ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.buttonText}>Save Changes</Text>
                  )}
                </Pressable>

                <Pressable
                  style={styles.cancelButton}
                  disabled={savingEvent}
                  onPress={() => {
                    setEditingEvent(null);
                    setActiveEditPicker(null);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.title}>Attendance History</Text>
          <Text style={styles.subtitle}>Your recorded attendance</Text>
        </View>
        <Ionicons name="time-outline" size={27} color={COLORS.primary} />
      </View>

      <View style={styles.studentSummary}>
        <Ionicons
          name="checkmark-circle-outline"
          size={22}
          color={COLORS.primary}
        />
        <View>
          <Text style={styles.summaryValue}>{studentRecords.length}</Text>
          <Text style={styles.summaryLabel}>Attendance records</Text>
        </View>
      </View>

      {studentRecords.length === 0 ? (
        <Empty
          icon="time-outline"
          title="No Records Yet"
          message="Scan an event QR code to register your attendance."
        />
      ) : (
        studentRecords.map((record) => (
          <View key={String(record.id)} style={styles.studentCard}>
            <View style={styles.eventIcon}>
              <Ionicons
                name="checkmark-circle-outline"
                size={21}
                color={COLORS.primary}
              />
            </View>
            <View style={styles.eventInfo}>
              <Text style={styles.eventTitle} numberOfLines={2}>
                {record.eventTitle}
              </Text>
              <Text style={styles.meta}>Code: {record.eventId}</Text>
              <Text style={styles.meta}>{formatDate(record.scannedAt)}</Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.iconAction} onPress={onPress}>
      <Ionicons name={icon} size={17} color={COLORS.primary} />
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

function Empty({
  icon,
  title,
  message,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  message: string;
}) {
  return (
    <View style={styles.emptyCard}>
      <Ionicons name={icon} size={30} color={COLORS.primary} />
      <Text style={styles.eventTitle}>{title}</Text>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}

function ModalHeader({
  title,
  subtitle,
  onClose,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
}) {
  return (
    <View style={styles.modalHeader}>
      <View style={styles.eventInfo}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.meta}>{subtitle}</Text>
      </View>
      <Pressable onPress={onClose} style={styles.closeButton}>
        <Ionicons name="close" size={21} color={COLORS.textPrimary} />
      </Pressable>
    </View>
  );
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function combineDateAndTime(datePart: Date, timePart: Date): Date {
  const result = new Date(datePart);
  result.setHours(
    timePart.getHours(),
    timePart.getMinutes(),
    timePart.getSeconds(),
    0
  );
  return result;
}

function formatPickerDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatPickerTime(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getEventStatus(
  start: string | null,
  end: string | null
): 'Upcoming' | 'Ongoing' | 'Ended' {
  const now = new Date();

  if (!start || now < new Date(start)) return 'Upcoming';
  if (end && now <= new Date(end)) return 'Ongoing';

  return 'Ended';
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getDateKey(value: string | null): string | null {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : dateKey(date);
}

function dateFromKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function readableDate(key: string): string {
  return dateFromKey(key).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function shortId(id: string): string {
  return id.length > 8 ? id.slice(-8) : id;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  muted: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  summaryCard: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  summaryLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  filterCard: {
    padding: 12,
    marginBottom: 18,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 9,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateButton: {
    flex: 1,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 9,
  },
  dateText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textPrimary,
  },
  clearButton: {
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  link: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  groupTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginTop: 8,
    marginBottom: 7,
  },
  eventCard: {
    marginBottom: 10,
    padding: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
  },
  eventMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  eventIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
  },
  eventInfo: {
    flex: 1,
    minWidth: 0,
  },
  eventTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 3,
  },
  meta: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 3,
    lineHeight: 15,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    marginTop: 3,
  },
  metaDetail: {
    flex: 1,
    fontSize: 10,
    color: COLORS.textSecondary,
    lineHeight: 15,
  },
  descriptionContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: COLORS.background,
    borderRadius: 8,
  },
  descriptionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 3,
  },
  descriptionText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },
  eventStats: {
    minWidth: 62,
    alignItems: 'flex-end',
  },
  attendeeCount: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  tinyLabel: {
    fontSize: 9,
    color: COLORS.textSecondary,
  },
  status: {
    fontSize: 9,
    fontWeight: '700',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
    marginTop: 6,
  },
  upcoming: {
    color: '#92400E',
    backgroundColor: '#FFF4D6',
  },
  ongoing: {
    color: '#166534',
    backgroundColor: '#DCFCE7',
  },
  ended: {
    color: '#4B5563',
    backgroundColor: '#F3F4F6',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  iconAction: {
    flex: 1,
    minWidth: 0,
    minHeight: 35,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 5,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
  },
  actionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
  },
  deleteAction: {
    flex: 0,
    width: 36,
    backgroundColor: '#FDECEC',
  },
  disabled: {
    opacity: 0.6,
  },
  emptyCard: {
    alignItems: 'center',
    gap: 8,
    padding: 22,
    marginTop: 8,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  studentSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
    marginBottom: 14,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
  },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    marginBottom: 9,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '85%',
    padding: 16,
    borderRadius: 16,
    backgroundColor: COLORS.card,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 14,
  },
  closeButton: {
    padding: 7,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
  },
  attendeeScroll: {
    maxHeight: 330,
    marginVertical: 8,
  },
  attendeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  attendeeIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 9,
  },
  qrWrap: {
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    alignSelf: 'center',
    marginVertical: 14,
  },
  modalDescription: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  primaryButton: {
    minHeight: 43,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 9,
    marginTop: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  input: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 9,
    paddingHorizontal: 11,
    marginBottom: 12,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.background,
    fontSize: 12,
  },
  multilineInput: {
    minHeight: 90,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  pickerButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 11,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 9,
    backgroundColor: COLORS.background,
  },
  pickerButtonText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textPrimary,
  },
  pickerContainer: {
    padding: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 9,
    backgroundColor: COLORS.background,
  },
  inputHint: {
    fontSize: 10,
    color: COLORS.textSecondary,
    lineHeight: 15,
    marginBottom: 8,
  },
  cancelButton: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    marginTop: 7,
    backgroundColor: COLORS.surface,
  },
  cancelButtonText: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
});
