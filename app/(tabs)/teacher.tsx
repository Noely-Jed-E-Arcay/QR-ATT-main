
import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import AppButton from '@/components/AppButton';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import {
  createEvent,
  getAvailableEvents,
  type CloudEvent,
} from '@/lib/events';
import { getProfile, type Role } from '@/lib/profiles';
import { buildQRPayload } from '@/lib/qr';

type EventFilter = 'All' | 'Upcoming' | 'Ongoing' | 'Completed';
type DateTarget = 'start' | 'end';

const QUICK_END_OPTIONS = [
  { label: '+30 min', ms: 30 * 60 * 1000 },
  { label: '+1 hour', ms: 60 * 60 * 1000 },
  { label: '+2 hours', ms: 2 * 60 * 60 * 1000 },
];

function formatDateTime(value: string | Date | null) {
  if (!value) return 'Schedule not set';

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return 'Invalid date';

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getEventStatus(
  event: CloudEvent,
  now: number,
): EventFilter | 'Unknown' | 'Schedule not set' {
  const start = event.start_time
    ? new Date(event.start_time).getTime()
    : null;
  const end = event.end_time
    ? new Date(event.end_time).getTime()
    : null;

  if (start !== null && Number.isNaN(start)) return 'Unknown';
  if (end !== null && Number.isNaN(end)) return 'Unknown';

  if (end !== null && now >= end) return 'Completed';
  if (start !== null && now < start) return 'Upcoming';

  if (
    start !== null &&
    now >= start &&
    (end === null || now < end)
  ) {
    return 'Ongoing';
  }

  return 'Schedule not set';
}

export default function TeacherScreen() {
  const { user } = useAuth();

  const [role, setRole] = useState<Role | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  const [events, setEvents] = useState<CloudEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [eventError, setEventError] = useState('');
  const [filter, setFilter] = useState<EventFilter>('All');
  const [search, setSearch] = useState('');
  const [now, setNow] = useState(Date.now());

  const [title, setTitle] = useState('');
  const [eventCode, setEventCode] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 60 * 60 * 1000),
  );
  const [dateTarget, setDateTarget] = useState<DateTarget | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>(
    'success',
  );
  const [createdEvent, setCreatedEvent] = useState<CloudEvent | null>(null);
  const [qrPayload, setQrPayload] = useState<string | null>(null);

  const isStudent = role === 'student';
  const isTeacher = role === 'teacher';
  const isAdmin = role === 'admin';

  const loadEvents = useCallback(async () => {
    setLoadingEvents(true);
    setEventError('');

    try {
      const result = await getAvailableEvents();

      setEvents(result.events);

      if (result.error) {
        setEventError(result.error);
      }
    } catch (error) {
      console.error('Unable to load school events:', error);
      setEventError('Unable to load school events. Please try again.');
    } finally {
      setLoadingEvents(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      if (!user) {
        setRole(null);
        setRoleLoading(false);
        setEvents([]);
        setLoadingEvents(false);

        return () => {
          active = false;
        };
      }

      setRoleLoading(true);

      getProfile(user.id)
        .then((profile) => {
          if (active) {
            setRole(profile?.role ?? 'student');
          }
        })
        .catch((error) => {
          console.error('Unable to load profile:', error);

          if (active) {
            setRole(null);
          }
        })
        .finally(() => {
          if (active) setRoleLoading(false);
        });

      void loadEvents();

      return () => {
        active = false;
      };
    }, [user, loadEvents]),
  );

  const filteredEvents = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return events
      .filter((event) => {
        const status = getEventStatus(event, now);

        if (filter !== 'All' && status !== filter) return false;

        if (!normalizedSearch) return true;

        return [
          event.title,
          event.event_code,
          event.location ?? '',
          event.description ?? '',
        ].some((value) => value.toLowerCase().includes(normalizedSearch));
      })
      .sort((a, b) => {
        const aTime = a.start_time
          ? new Date(a.start_time).getTime()
          : Number.MAX_SAFE_INTEGER;
        const bTime = b.start_time
          ? new Date(b.start_time).getTime()
          : Number.MAX_SAFE_INTEGER;

        const safeATime = Number.isNaN(aTime)
          ? Number.MAX_SAFE_INTEGER
          : aTime;
        const safeBTime = Number.isNaN(bTime)
          ? Number.MAX_SAFE_INTEGER
          : bTime;

        return safeATime - safeBTime;
      });
  }, [events, filter, search, now]);

  const handleDateChange = (
    event: DateTimePickerEvent,
    selected?: Date,
  ) => {
    if (event.type === 'dismissed' || !selected || !dateTarget) {
      setDateTarget(null);
      return;
    }

    if (dateTarget === 'start') {
      setStartDate(selected);

      if (endDate.getTime() <= selected.getTime()) {
        setEndDate(new Date(selected.getTime() + 60 * 60 * 1000));
      }
    } else {
      setEndDate(selected);
    }

    if (Platform.OS === 'android') {
      setDateTarget(null);
    }
  };

  const handleCreateEvent = async () => {
    if (saving) return;

    setMessage('');
    setCreatedEvent(null);
    setQrPayload(null);

    if (!user || (!isTeacher && !isAdmin)) {
      setMessageType('error');
      setMessage('Your account is not authorized to create events.');
      return;
    }

    if (
      !title.trim() ||
      !eventCode.trim() ||
      !location.trim() ||
      !description.trim()
    ) {
      setMessageType('error');
      setMessage('Complete all required event details.');
      return;
    }

    if (
      !Number.isFinite(startDate.getTime()) ||
      !Number.isFinite(endDate.getTime()) ||
      endDate.getTime() <= startDate.getTime()
    ) {
      setMessageType('error');
      setMessage('The event end time must be after its start time.');
      return;
    }

    setSaving(true);

    try {
      // IMPORTANT: createEvent accepts one object and returns a result.
      const result = await createEvent({
        event_code: eventCode.trim().toUpperCase(),
        title: title.trim(),
        location: location.trim() || null,
        description: description.trim() || null,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
      });

      if (result.error || !result.event) {
        setMessageType('error');
        setMessage(result.error ?? 'Unable to create event.');
        return;
      }

      const created = result.event;

      setCreatedEvent(created);

      setQrPayload(
        buildQRPayload({
          eventId: created.event_code,
          title: created.title,
          start: created.start_time ?? startDate.toISOString(),
          end: created.end_time ?? endDate.toISOString(),
        }),
      );

      setMessageType('success');
      setMessage('Event created successfully.');

      setTitle('');
      setEventCode('');
      setLocation('');
      setDescription('');

      await loadEvents();
    } catch (error) {
      console.error('Unable to create event:', error);
      setMessageType('error');
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to create event.',
      );
    } finally {
      setSaving(false);
    }
  };

  if (roleLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.muted}>Loading your account...</Text>
      </View>
    );
  }

  if (!user || !role) {
    return (
      <View style={styles.centered}>
        <Ionicons
          name="lock-closed-outline"
          size={38}
          color={COLORS.primary}
        />
        <Text style={styles.pageTitle}>Unable to load account</Text>
        <Text style={styles.muted}>
          Please return to your dashboard and try again.
        </Text>
      </View>
    );
  }

  if (isStudent) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pageHeading}>
          <View style={styles.headingIcon}>
            <Ionicons
              name="calendar-outline"
              size={27}
              color={COLORS.primary}
            />
          </View>
          <View style={styles.headingText}>
            <Text style={styles.pageTitle}>Available Events</Text>
            <Text style={styles.muted}>
              Browse school events and check their current status.
            </Text>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryNumber}>{events.length}</Text>
          <Text style={styles.summaryLabel}>School events</Text>
          <Text style={styles.summaryHint}>
            Includes upcoming, ongoing, and completed events.
          </Text>
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
            placeholder="Search title, code, or location"
            placeholderTextColor={COLORS.textSecondary}
            style={styles.searchInput}
            autoCapitalize="none"
          />
          {!!search && (
            <Pressable onPress={() => setSearch('')}>
              <Ionicons
                name="close-circle"
                size={19}
                color={COLORS.textSecondary}
              />
            </Pressable>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {(['All', 'Upcoming', 'Ongoing', 'Completed'] as EventFilter[]).map(
            (item) => (
              <Pressable
                key={item}
                onPress={() => setFilter(item)}
                style={[
                  styles.filterChip,
                  filter === item && styles.filterChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterText,
                    filter === item && styles.filterTextActive,
                  ]}
                >
                  {item}
                </Text>
              </Pressable>
            ),
          )}
        </ScrollView>

        {loadingEvents ? (
          <View style={styles.stateCard}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.muted}>Loading school events...</Text>
          </View>
        ) : eventError ? (
          <View style={styles.stateCard}>
            <Ionicons
              name="alert-circle-outline"
              size={32}
              color={COLORS.danger}
            />
            <Text style={styles.stateTitle}>Couldn't load events</Text>
            <Text style={styles.muted}>{eventError}</Text>
            <AppButton
              theme="primary"
              title="Try Again"
              icon="refresh-outline"
              onPress={() => void loadEvents()}
            />
          </View>
        ) : filteredEvents.length === 0 ? (
          <View style={styles.stateCard}>
            <Ionicons
              name="calendar-clear-outline"
              size={34}
              color={COLORS.primary}
            />
            <Text style={styles.stateTitle}>No events found</Text>
            <Text style={styles.muted}>
              Try another filter or search term. Newly published events will
              appear here when available.
            </Text>
            {(filter !== 'All' || search) && (
              <Pressable
                style={styles.resetButton}
                onPress={() => {
                  setFilter('All');
                  setSearch('');
                }}
              >
                <Text style={styles.resetButtonText}>Clear filters</Text>
              </Pressable>
            )}
          </View>
        ) : (
          filteredEvents.map((event) => {
            const status = getEventStatus(event, now);

            return (
              <View key={event.id} style={styles.eventCard}>
                <View style={styles.eventTopRow}>
                  <View style={styles.eventIcon}>
                    <Ionicons
                      name="calendar"
                      size={22}
                      color={COLORS.primary}
                    />
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      status === 'Upcoming' && styles.upcomingBadge,
                      status === 'Ongoing' && styles.ongoingBadge,
                      status === 'Completed' && styles.completedBadge,
                    ]}
                  >
                    <Text style={styles.statusText}>{status}</Text>
                  </View>
                </View>

                <Text style={styles.eventTitle}>{event.title}</Text>

                {!!event.description && (
                  <Text style={styles.eventDescription}>
                    {event.description}
                  </Text>
                )}

                <View style={styles.detailRow}>
                  <Ionicons
                    name="time-outline"
                    size={16}
                    color={COLORS.textSecondary}
                  />
                  <Text style={styles.detailText}>
                    Starts: {formatDateTime(event.start_time)}
                  </Text>
                </View>

                {!!event.end_time && (
                  <View style={styles.detailRow}>
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={16}
                      color={COLORS.textSecondary}
                    />
                    <Text style={styles.detailText}>
                      Ends: {formatDateTime(event.end_time)}
                    </Text>
                  </View>
                )}

                {!!event.location && (
                  <View style={styles.detailRow}>
                    <Ionicons
                      name="location-outline"
                      size={16}
                      color={COLORS.textSecondary}
                    />
                    <Text style={styles.detailText}>{event.location}</Text>
                  </View>
                )}

                <View style={styles.codeRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.codeLabel}>EVENT CODE</Text>
                    <Text selectable style={styles.codeValue}>
                      {event.event_code}
                    </Text>
                  </View>
                  <Pressable
                    style={styles.refreshButton}
                    onPress={() => {
                      const currentTime = Date.now();
                      setNow(currentTime);
                      Alert.alert(
                        'Event status',
                        `${event.title}: ${getEventStatus(event, currentTime)}`,
                      );
                    }}
                  >
                    <Ionicons
                      name="refresh-outline"
                      size={18}
                      color={COLORS.primary}
                    />
                  </Pressable>
                </View>
              </View>
            );
          })
        )}

        <Pressable
          style={styles.reloadLink}
          onPress={() => {
            setNow(Date.now());
            void loadEvents();
          }}
        >
          <Ionicons
            name="refresh-outline"
            size={17}
            color={COLORS.primary}
          />
          <Text style={styles.reloadLinkText}>Refresh events</Text>
        </Pressable>
      </ScrollView>
    );
  }

  if (!isTeacher && !isAdmin) {
    return (
      <View style={styles.centered}>
        <Ionicons
          name="lock-closed-outline"
          size={38}
          color={COLORS.primary}
        />
        <Text style={styles.pageTitle}>Access unavailable</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.pageHeading}>
        <View style={styles.headingIcon}>
          <Ionicons
            name="qr-code-outline"
            size={27}
            color={COLORS.primary}
          />
        </View>
        <View style={styles.headingText}>
          <Text style={styles.pageTitle}>Create Event</Text>
          <Text style={styles.muted}>
            Set up a school event and generate its attendance QR code.
          </Text>
        </View>
      </View>

      <View style={styles.roleBanner}>
        <Ionicons
          name={isAdmin ? 'shield-checkmark-outline' : 'school-outline'}
          size={23}
          color={COLORS.primary}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.stateTitle}>
            {isAdmin ? 'Administrator Access' : 'Teacher Access'}
          </Text>
          <Text style={styles.muted}>
            Create school events and generate QR codes for attendance.
          </Text>
        </View>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.formHeading}>Event Information</Text>

        <FieldLabel text="Event Title" />
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Founders Day Assembly"
          placeholderTextColor={COLORS.textSecondary}
          maxLength={150}
        />

        <FieldLabel text="Event Code" />
        <TextInput
          style={styles.input}
          value={eventCode}
          onChangeText={setEventCode}
          placeholder="e.g. EVT-2026-0002"
          placeholderTextColor={COLORS.textSecondary}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={50}
        />

        <FieldLabel text="Location" />
        <TextInput
          style={styles.input}
          value={location}
          onChangeText={setLocation}
          placeholder="Enter event location"
          placeholderTextColor={COLORS.textSecondary}
          maxLength={200}
        />

        <FieldLabel text="Description" />
        <TextInput
          style={[styles.input, styles.descriptionInput]}
          value={description}
          onChangeText={setDescription}
          placeholder="Describe this event"
          placeholderTextColor={COLORS.textSecondary}
          multiline
          textAlignVertical="top"
          maxLength={1000}
        />

        <Text style={styles.formHeading}>Event Schedule</Text>

        <FieldLabel text="Start Date and Time" />
        <Pressable
          style={styles.dateButton}
          onPress={() => setDateTarget('start')}
        >
          <Ionicons
            name="calendar-outline"
            size={20}
            color={COLORS.primary}
          />
          <Text style={styles.dateButtonText}>
            {formatDateTime(startDate)}
          </Text>
        </Pressable>

        <FieldLabel text="End Date and Time" />
        <Pressable
          style={styles.dateButton}
          onPress={() => setDateTarget('end')}
        >
          <Ionicons
            name="calendar-outline"
            size={20}
            color={COLORS.primary}
          />
          <Text style={styles.dateButtonText}>
            {formatDateTime(endDate)}
          </Text>
        </Pressable>

        <View style={styles.quickEndRow}>
          {QUICK_END_OPTIONS.map((option) => (
            <Pressable
              key={option.label}
              style={styles.filterChip}
              onPress={() =>
                setEndDate(
                  new Date(startDate.getTime() + option.ms),
                )
              }
            >
              <Text style={styles.filterText}>{option.label}</Text>
            </Pressable>
          ))}
        </View>

        {dateTarget && (
          <DateTimePicker
            value={dateTarget === 'start' ? startDate : endDate}
            mode="datetime"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleDateChange}
          />
        )}

        {!!message && (
          <View
            style={[
              styles.messageBox,
              messageType === 'success'
                ? styles.successMessage
                : styles.errorMessage,
            ]}
          >
            <Ionicons
              name={
                messageType === 'success'
                  ? 'checkmark-circle-outline'
                  : 'alert-circle-outline'
              }
              size={20}
              color={
                messageType === 'success'
                  ? COLORS.success
                  : COLORS.danger
              }
            />
            <Text
              style={[
                styles.messageText,
                {
                  color:
                    messageType === 'success'
                      ? COLORS.success
                      : COLORS.danger,
                },
              ]}
            >
              {message}
            </Text>
          </View>
        )}

        <AppButton
          theme="primary"
          title={saving ? 'Saving Event...' : 'Create Event & Generate QR'}
          icon="qr-code-outline"
          onPress={() => void handleCreateEvent()}
        />

        {saving && (
          <ActivityIndicator
            style={{ marginTop: 12 }}
            color={COLORS.primary}
          />
        )}
      </View>

      {createdEvent && qrPayload && (
        <View style={styles.formCard}>
          <View style={styles.createdHeader}>
            <Ionicons
              name="checkmark-circle"
              size={27}
              color={COLORS.success}
            />
            <Text style={styles.formHeading}>Event Created</Text>
          </View>

          <Text style={styles.eventTitle}>{createdEvent.title}</Text>
          <Text style={styles.detailText}>
            Code: {createdEvent.event_code}
          </Text>
          <Text style={styles.detailText}>
            Location: {createdEvent.location || 'Not specified'}
          </Text>
          <Text style={styles.detailText}>
            Starts: {formatDateTime(createdEvent.start_time)}
          </Text>
          <Text style={styles.detailText}>
            Ends: {formatDateTime(createdEvent.end_time)}
          </Text>

          <View style={styles.qrBox}>
            <QRCode value={qrPayload} size={200} />
          </View>

          <Text style={styles.muted}>
            Scan this QR code to test the event attendance flow.
          </Text>
          <Text selectable style={styles.codeValue}>
            {qrPayload}
          </Text>
        </View>
      )}

      <Text style={styles.footer}>
        QR Attendance · {isAdmin ? 'Administrator' : 'Teacher'} Workspace
      </Text>
    </ScrollView>
  );
}

function FieldLabel({ text }: { text: string }) {
  return <Text style={styles.fieldLabel}>{text} *</Text>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 36,
  },
  centered: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  pageHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    marginBottom: 18,
  },
  headingIcon: {
    width: 54,
    height: 54,
    borderRadius: 17,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headingText: {
    flex: 1,
  },
  pageTitle: {
    fontSize: 23,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  muted: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  summaryCard: {
    backgroundColor: COLORS.textSecondary,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
  },
  summaryNumber: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
  },
  summaryLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 3,
  },
  summaryHint: {
    color: COLORS.surface,
    fontSize: 11,
    marginTop: 6,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 13,
    minHeight: 48,
    borderRadius: 13,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 13,
  },
  searchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 13,
    paddingVertical: 10,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 14,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: COLORS.surface,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
  },
  filterText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  stateCard: {
    backgroundColor: COLORS.card,
    borderRadius: 17,
    padding: 24,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  stateTitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  eventCard: {
    backgroundColor: COLORS.card,
    borderRadius: 17,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  eventTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  eventIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: COLORS.surface,
  },
  upcomingBadge: {
    backgroundColor: '#E8EDFF',
  },
  ongoingBadge: {
    backgroundColor: '#E5F5EA',
  },
  completedBadge: {
    backgroundColor: '#ECECEC',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 7,
  },
  eventDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textSecondary,
    marginBottom: 9,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 8,
  },
  detailText: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: 11,
    lineHeight: 17,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
    marginTop: 13,
  },
  codeLabel: {
    color: COLORS.textSecondary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.7,
    marginBottom: 4,
  },
  codeValue: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 18,
    marginTop: 5,
  },
  refreshButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 11,
  },
  resetButton: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  resetButtonText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  reloadLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 14,
  },
  reloadLinkText: {
    color: COLORS.primary,
    fontWeight: '800',
    fontSize: 12,
  },
  roleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    marginBottom: 16,
  },
  formCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
    gap: 9,
  },
  formHeading: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  fieldLabel: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 8,
    marginBottom: 2,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: COLORS.textPrimary,
    fontSize: 13,
  },
  descriptionInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 13,
  },
  dateButtonText: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 12,
    lineHeight: 18,
  },
  quickEndRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 5,
    marginBottom: 10,
  },
  messageBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    marginVertical: 7,
  },
  successMessage: {
    backgroundColor: '#E8F4EC',
  },
  errorMessage: {
    backgroundColor: '#FCEBE9',
  },
  messageText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  createdHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  qrBox: {
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginVertical: 16,
  },
  footer: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    fontSize: 10,
    marginTop: 12,
  },
});
