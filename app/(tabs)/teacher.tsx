
import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
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
import { createEvent } from '@/lib/events';
import { getProfile, type Role } from '@/lib/profiles';
import { buildQRPayload } from '@/lib/qr';

function toLocalISO(date: Date): string {
  return date.toISOString();
}

function formatDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');

  const month = date.toLocaleString('en-US', {
    month: 'short',
  });

  return `${month} ${pad(date.getDate())}, ${date.getFullYear()} at ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

const QUICK_END_OPTIONS = [
  { label: '+30 min', ms: 30 * 60 * 1000 },
  { label: '+1 hour', ms: 60 * 60 * 1000 },
  { label: '+2 hours', ms: 2 * 60 * 60 * 1000 },
];

type EditTarget = 'start' | 'end';

export default function TeacherScreen() {
  const { user } = useAuth();

  const [role, setRole] = useState<Role | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  const [title, setTitle] = useState('');
  const [eventId, setEventId] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');

  const [startDate, setStartDate] = useState(() => new Date());

  const [endDate, setEndDate] = useState(
    () => new Date(Date.now() + 60 * 60 * 1000)
  );

  const [editTarget, setEditTarget] =
    useState<EditTarget | null>(null);

  const [editingPart, setEditingPart] =
    useState<'date' | 'time'>('date');

  const [payload, setPayload] = useState<string | null>(null);

  const [createdEvent, setCreatedEvent] = useState<{
    eventId: string;
    title: string;
    location: string;
    description: string;
    start: string;
    end: string;
  } | null>(null);

  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      if (!user) {
        setRole(null);
        setRoleLoading(false);

        return () => {
          active = false;
        };
      }

      setRoleLoading(true);

      getProfile(user.id)
        .then((profile) => {
          if (!active) return;
          setRole(profile?.role ?? 'student');
        })
        .catch(() => {
          if (!active) return;
          setRole('student');
        })
        .finally(() => {
          if (active) setRoleLoading(false);
        });

      return () => {
        active = false;
      };
    }, [user])
  );

  const isAndroid = Platform.OS === 'android';

  const openPicker = (target: EditTarget) => {
    setMessage(null);
    setEditTarget(target);
    setEditingPart('date');
  };

  const onPickerChange = (
    event: DateTimePickerEvent,
    selected?: Date
  ) => {
    if (!editTarget) return;

    if (event.type === 'dismissed' || !selected) {
      setEditTarget(null);
      setEditingPart('date');
      return;
    }

    const current =
      editTarget === 'start' ? startDate : endDate;

    const next = new Date(current);

    next.setFullYear(
      selected.getFullYear(),
      selected.getMonth(),
      selected.getDate()
    );

    next.setHours(
      selected.getHours(),
      selected.getMinutes(),
      0,
      0
    );

    if (editTarget === 'start') {
      setStartDate(next);
    } else {
      setEndDate(next);
    }

    if (isAndroid && editingPart === 'date') {
      setEditingPart('time');
    } else {
      setEditTarget(null);
      setEditingPart('date');
    }
  };

  const handleQuickEnd = (ms: number) => {
    setMessage(null);
    setEndDate(new Date(startDate.getTime() + ms));
  };

  const handleCreateEvent = async () => {
    if (saving) return;

    setMessage(null);
    setPayload(null);
    setCreatedEvent(null);

    // Preserve the code entered by the teacher.
    const trimmedEventId = eventId.trim().toUpperCase();
    const trimmedTitle = title.trim();
    const trimmedLocation = location.trim();
    const trimmedDescription = description.trim();

    if (!trimmedEventId || !trimmedTitle) {
      setMessage('Event title and code are required.');
      return;
    }

    if (!trimmedLocation) {
      setMessage('Please enter the event location.');
      return;
    }

    if (!trimmedDescription) {
      setMessage('Please enter a description of the event.');
      return;
    }

    if (
      !Number.isFinite(startDate.getTime()) ||
      !Number.isFinite(endDate.getTime())
    ) {
      setMessage('Please select valid start and end times.');
      return;
    }

    if (endDate.getTime() <= startDate.getTime()) {
      setMessage('End time must be after start time.');
      return;
    }

    setSaving(true);

    try {
      // The sixth argument is the exact code entered in the form.
      const { event, error } = await createEvent(
        trimmedTitle,
        toLocalISO(startDate),
        toLocalISO(endDate),
        trimmedDescription,
        trimmedLocation,
        trimmedEventId
      );

      if (error || !event) {
        setMessage(
          error ?? 'Could not save the event. Please try again.'
        );
        return;
      }

      const eventData = {
        eventId: event.event_code,
        title: event.title,
        location: event.location ?? trimmedLocation,
        description: event.description ?? trimmedDescription,
        start: event.start_time ?? toLocalISO(startDate),
        end: event.end_time ?? toLocalISO(endDate),
      };

      setCreatedEvent(eventData);
      setMessage(
        'Event saved successfully! Your event QR code is ready.'
      );

      setPayload(
        buildQRPayload({
          eventId: eventData.eventId,
          title: eventData.title,
          start: eventData.start,
          end: eventData.end,
        })
      );
    } catch (error) {
      console.error('handleCreateEvent failed:', error);

      setMessage(
        error instanceof Error
          ? error.message
          : 'Could not save the event. Please check your connection and try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (roleLoading) {
    return (
      <View style={styles.lockContainer}>
        <Text style={styles.lockTitle}>
          Checking your account...
        </Text>
      </View>
    );
  }

  if (!user || (role !== 'teacher' && role !== 'admin')) {
    return (
      <View style={styles.lockContainer}>
        <Ionicons
          name="lock-closed-outline"
          size={48}
          color={COLORS.primary}
        />

        <Text style={styles.lockTitle}>
          Teachers and Admins Only
        </Text>

        <Text style={styles.lockSubtitle}>
          Only teacher and admin accounts can create events.
        </Text>
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
      <Text style={styles.title}>Create Event QR</Text>

      <Text style={styles.subtitle}>
        Fill in the event details, then generate a QR code for attendance.
      </Text>

      <Text style={styles.label}>Event Title</Text>

      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Founders Day Assembly"
        placeholderTextColor={COLORS.textSecondary}
        editable={!saving}
      />

      <Text style={styles.label}>Event Code</Text>

      <TextInput
        style={styles.input}
        value={eventId}
        onChangeText={setEventId}
        placeholder="e.g. EVT-2026-0002"
        placeholderTextColor={COLORS.textSecondary}
        autoCapitalize="characters"
        editable={!saving}
      />

      <Text style={styles.label}>Location</Text>

      <TextInput
        style={styles.input}
        value={location}
        onChangeText={setLocation}
        placeholder="e.g. Room 204, Main Gymnasium"
        placeholderTextColor={COLORS.textSecondary}
        autoCapitalize="words"
        editable={!saving}
      />

      <Text style={styles.label}>Event Description</Text>

      <Text style={styles.fieldHint}>
        Explain what the event is about, its purpose, and what participants can expect.
      </Text>

      <TextInput
        style={[styles.input, styles.descriptionInput]}
        value={description}
        onChangeText={setDescription}
        placeholder="Describe the purpose and activities of this event..."
        placeholderTextColor={COLORS.textSecondary}
        multiline
        textAlignVertical="top"
        maxLength={1000}
        editable={!saving}
      />

      <Text style={styles.characterCount}>
        {description.length}/1000 characters
      </Text>

      <Text style={styles.label}>Starts</Text>

      <PickerField
        value={formatDateTime(startDate)}
        icon="sunny-outline"
        onPress={() => openPicker('start')}
      />

      <Text style={styles.label}>Ends</Text>

      <PickerField
        value={formatDateTime(endDate)}
        icon="moon-outline"
        onPress={() => openPicker('end')}
      />

      <View style={styles.chipRow}>
        {QUICK_END_OPTIONS.map((option) => (
          <Pressable
            key={option.label}
            disabled={saving}
            style={({ pressed }) => [
              styles.chip,
              pressed && styles.chipPressed,
            ]}
            onPress={() => handleQuickEnd(option.ms)}
          >
            <Text style={styles.chipText}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.hint}>
        Tap a chip to set the end time relative to the start time.
      </Text>

      {message && (
        <Text style={styles.message}>{message}</Text>
      )}

      <AppButton
        theme="primary"
        title={saving ? 'Saving Event...' : 'Create Event'}
        icon="add-circle-outline"
        onPress={handleCreateEvent}
      />

      {editTarget && (
        <View style={styles.pickerContainer}>
          <DateTimePicker
            value={editTarget === 'start' ? startDate : endDate}
            mode={isAndroid ? editingPart : 'datetime'}
            display={isAndroid ? 'default' : 'spinner'}
            onChange={onPickerChange}
          />
        </View>
      )}

      {payload && createdEvent && (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>
            Event Created Successfully
          </Text>

          <Text style={styles.resultSubtitle}>
            Scan this QR code with the Scan tab to test attendance.
          </Text>

          <View style={styles.eventInformation}>
            <InfoRow
              icon="barcode-outline"
              label="Code"
              value={createdEvent.eventId}
            />

            <InfoRow
              icon="text-outline"
              label="Title"
              value={createdEvent.title}
            />

            <InfoRow
              icon="location-outline"
              label="Location"
              value={createdEvent.location}
            />

            <InfoRow
              icon="document-text-outline"
              label="Description"
              value={createdEvent.description}
            />

            <InfoRow
              icon="calendar-outline"
              label="Starts"
              value={formatDateTime(new Date(createdEvent.start))}
            />

            <InfoRow
              icon="time-outline"
              label="Ends"
              value={formatDateTime(new Date(createdEvent.end))}
            />
          </View>

          <View style={styles.qrBox}>
            <QRCode value={payload} size={200} />
          </View>

          <Text style={styles.payloadText}>{payload}</Text>
        </View>
      )}
    </ScrollView>
  );
}

type PickerFieldProps = {
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

function PickerField({
  value,
  icon,
  onPress,
}: PickerFieldProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.pickerField,
        pressed && styles.pickerFieldPressed,
      ]}
      onPress={onPress}
    >
      <Ionicons
        name={icon}
        size={20}
        color={COLORS.primary}
      />

      <Text style={styles.pickerValue}>{value}</Text>

      <Ionicons
        name="calendar-outline"
        size={18}
        color={COLORS.textSecondary}
      />
    </Pressable>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.eventInformationRow}>
      <Ionicons
        name={icon}
        size={18}
        color={COLORS.primary}
      />

      <View style={styles.infoTextContainer}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.eventInformationText}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },

  lockContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  lockTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginTop: 12,
    textAlign: 'center',
  },

  lockSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginTop: 6,
    textAlign: 'center',
  },

  title: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },

  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },

  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 6,
    marginTop: 10,
  },

  input: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.textPrimary,
  },

  descriptionInput: {
    minHeight: 120,
    paddingTop: 12,
  },

  fieldHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: 8,
  },

  characterCount: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'right',
    marginTop: 5,
  },

  pickerField: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },

  pickerFieldPressed: {
    backgroundColor: COLORS.surface,
  },

  pickerValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.textPrimary,
    marginHorizontal: 10,
  },

  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },

  chip: {
    backgroundColor: COLORS.surface,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
    marginBottom: 6,
  },

  chipPressed: {
    opacity: 0.7,
  },

  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },

  hint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 6,
  },

  pickerContainer: {
    marginTop: 12,
    alignItems: 'center',
  },

  message: {
    fontSize: 14,
    color: COLORS.primary,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 8,
  },

  resultCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    marginTop: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  resultTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 6,
  },

  resultSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 12,
  },

  eventInformation: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },

  eventInformationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 6,
  },

  infoTextContainer: {
    flex: 1,
    marginLeft: 8,
  },

  infoLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 2,
  },

  eventInformationText: {
    fontSize: 13,
    color: COLORS.textPrimary,
    lineHeight: 19,
  },

  qrBox: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },

  payloadText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
});
