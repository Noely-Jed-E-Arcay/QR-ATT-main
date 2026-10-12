import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
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
  const month = date.toLocaleString('en-US', { month: 'short' });

  return `${month} ${pad(date.getDate())}, ${date.getFullYear()} at ${pad(
    date.getHours(),
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
    () => new Date(Date.now() + 60 * 60 * 1000),
  );

  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [editingPart, setEditingPart] = useState<'date' | 'time'>('date');

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
  const [messageType, setMessageType] = useState<'success' | 'error'>(
    'success',
  );
  const [saving, setSaving] = useState(false);

  const isAndroid = Platform.OS === 'android';
  const isAdmin = role === 'admin';
  const isTeacher = role === 'teacher';

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
          if (active) {
            setRole(profile?.role ?? 'student');
          }
        })
        .catch((error) => {
          console.error('Unable to load user profile:', error);
          if (active) setRole(null);
        })
        .finally(() => {
          if (active) setRoleLoading(false);
        });

      return () => {
        active = false;
      };
    }, [user]),
  );

  const openPicker = (target: EditTarget) => {
    setMessage(null);
    setEditTarget(target);
    setEditingPart('date');
  };

  const onPickerChange = (
    event: DateTimePickerEvent,
    selected?: Date,
  ) => {
    if (!editTarget) return;

    if (event.type === 'dismissed' || !selected) {
      setEditTarget(null);
      setEditingPart('date');
      return;
    }

    const current = editTarget === 'start' ? startDate : endDate;
    const next = new Date(current);

    next.setFullYear(
      selected.getFullYear(),
      selected.getMonth(),
      selected.getDate(),
    );
    next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);

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

    if (!user || (!isAdmin && !isTeacher)) {
      setMessageType('error');
      setMessage('Your account is not authorized to create events.');
      return;
    }

    const trimmedEventId = eventId.trim().toUpperCase();
    const trimmedTitle = title.trim();
    const trimmedLocation = location.trim();
    const trimmedDescription = description.trim();

    if (!trimmedEventId || !trimmedTitle) {
      setMessageType('error');
      setMessage('Event title and event code are required.');
      return;
    }

    if (!trimmedLocation) {
      setMessageType('error');
      setMessage('Please enter the event location.');
      return;
    }

    if (!trimmedDescription) {
      setMessageType('error');
      setMessage('Please enter an event description.');
      return;
    }

    if (
      !Number.isFinite(startDate.getTime()) ||
      !Number.isFinite(endDate.getTime())
    ) {
      setMessageType('error');
      setMessage('Please select valid start and end times.');
      return;
    }

    if (endDate.getTime() <= startDate.getTime()) {
      setMessageType('error');
      setMessage('The end time must be after the start time.');
      return;
    }

    setSaving(true);

    try {
      const { event, error } = await createEvent(
        trimmedTitle,
        toLocalISO(startDate),
        toLocalISO(endDate),
        trimmedDescription,
        trimmedLocation,
        trimmedEventId,
      );

      if (error || !event) {
        setMessageType('error');
        setMessage(error ?? 'Could not save the event. Please try again.');
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
      setMessageType('success');
      setMessage('Event saved successfully! Your QR code is ready.');

      setPayload(
        buildQRPayload({
          eventId: eventData.eventId,
          title: eventData.title,
          start: eventData.start,
          end: eventData.end,
        }),
      );
    } catch (error) {
      console.error('handleCreateEvent failed:', error);
      setMessageType('error');
      setMessage(
        error instanceof Error
          ? error.message
          : 'Could not save the event. Check your connection and try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  if (roleLoading) {
    return (
      <View style={styles.lockContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.lockTitle}>Checking your account...</Text>
      </View>
    );
  }

  if (!user || (!isTeacher && !isAdmin)) {
    return (
      <View style={styles.lockContainer}>
        <View style={styles.lockIcon}>
          <Ionicons
            name="lock-closed-outline"
            size={34}
            color={COLORS.primary}
          />
        </View>

        <Text style={styles.lockTitle}>Teachers and Admins Only</Text>

        <Text style={styles.lockSubtitle}>
          Only teacher and administrator accounts can create school events
          and generate attendance QR codes.
        </Text>
      </View>
    );
  }

  const roleLabel = isAdmin ? 'ADMINISTRATOR' : 'TEACHER';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* PAGE HEADING */}
      <View style={styles.pageHeading}>
        <View style={styles.headingIcon}>
          <Ionicons
            name="qr-code-outline"
            size={28}
            color={COLORS.primary}
          />
        </View>

        <View style={styles.headingText}>
          <Text style={styles.title}>Create Event</Text>
          <Text style={styles.subtitle}>
            Set up a school event and generate its attendance QR code.
          </Text>
        </View>
      </View>

      {/* ROLE INDICATOR */}
      <View style={styles.roleBanner}>
        <View style={styles.roleBannerIcon}>
          <Ionicons
            name={isAdmin ? 'shield-checkmark-outline' : 'school-outline'}
            size={20}
            color={COLORS.primary}
          />
        </View>

        <View style={styles.roleBannerContent}>
          <Text style={styles.roleBannerTitle}>
            {isAdmin ? 'Administrator Access' : 'Teacher Access'}
          </Text>
          <Text style={styles.roleBannerText}>
            Signed in as {roleLabel.toLowerCase()}. You can create school
            events using this screen.
          </Text>
        </View>
      </View>

      {/* INFORMATION BANNER */}
      <View style={styles.infoBanner}>
        <Ionicons
          name="information-circle-outline"
          size={22}
          color={COLORS.primary}
        />
        <Text style={styles.infoBannerText}>
          Complete the event details below. After the event is saved, its QR
          code will be generated for attendance scanning.
        </Text>
      </View>

      {/* EVENT DETAILS */}
      <View style={styles.card}>
        <View style={styles.sectionHeading}>
          <View style={styles.sectionIcon}>
            <Ionicons
              name="document-text-outline"
              size={20}
              color={COLORS.primary}
            />
          </View>

          <View style={styles.sectionHeadingText}>
            <Text style={styles.sectionTitle}>Event Information</Text>
            <Text style={styles.sectionSubtitle}>
              Enter the basic details of your event.
            </Text>
          </View>
        </View>

        <FieldLabel title="Event Title" required />
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Founders Day Assembly"
          placeholderTextColor={COLORS.textSecondary}
          editable={!saving}
          maxLength={150}
        />

        <FieldLabel title="Event Code" required />
        <TextInput
          style={styles.input}
          value={eventId}
          onChangeText={setEventId}
          placeholder="e.g. EVT-2026-0002"
          placeholderTextColor={COLORS.textSecondary}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!saving}
          maxLength={50}
        />
        <Text style={styles.fieldHint}>
          Use a unique code for this event.
        </Text>

        <FieldLabel title="Location" required />
        <TextInput
          style={styles.input}
          value={location}
          onChangeText={setLocation}
          placeholder="e.g. Room 204, Main Gymnasium"
          placeholderTextColor={COLORS.textSecondary}
          autoCapitalize="words"
          editable={!saving}
          maxLength={200}
        />

        <FieldLabel title="Event Description" required />
        <Text style={styles.fieldHint}>
          Explain the event&apos;s purpose and what participants can expect.
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
      </View>

      {/* EVENT SCHEDULE */}
      <View style={styles.card}>
        <View style={styles.sectionHeading}>
          <View style={styles.sectionIcon}>
            <Ionicons
              name="calendar-outline"
              size={20}
              color={COLORS.primary}
            />
          </View>

          <View style={styles.sectionHeadingText}>
            <Text style={styles.sectionTitle}>Event Schedule</Text>
            <Text style={styles.sectionSubtitle}>
              Choose when your event begins and ends.
            </Text>
          </View>
        </View>

        <FieldLabel title="Start Date and Time" required />
        <PickerField
          value={formatDateTime(startDate)}
          icon="play-circle-outline"
          onPress={() => openPicker('start')}
          disabled={saving}
        />

        <FieldLabel title="End Date and Time" required />
        <PickerField
          value={formatDateTime(endDate)}
          icon="stop-circle-outline"
          onPress={() => openPicker('end')}
          disabled={saving}
        />

        <Text style={styles.quickLabel}>Quick end time</Text>

        <View style={styles.chipRow}>
          {QUICK_END_OPTIONS.map((option) => (
            <Pressable
              key={option.label}
              disabled={saving}
              style={({ pressed }) => [
                styles.chip,
                pressed && styles.chipPressed,
                saving && styles.disabled,
              ]}
              onPress={() => handleQuickEnd(option.ms)}
            >
              <Ionicons
                name="time-outline"
                size={15}
                color={COLORS.primary}
              />
              <Text style={styles.chipText}>{option.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.fieldHint}>
          Quick options set the end time relative to the selected start time.
        </Text>

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
      </View>

      {/* FEEDBACK */}
      {message && (
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
            size={21}
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

      {/* CREATE EVENT */}
      <View style={styles.actionContainer}>
        <AppButton
          theme="primary"
          title={saving ? 'Saving Event...' : 'Create Event & Generate QR'}
          icon="qr-code-outline"
          onPress={handleCreateEvent}
        />

        {saving && (
          <ActivityIndicator
            size="small"
            color={COLORS.primary}
            style={styles.savingIndicator}
          />
        )}

        <Text style={styles.actionHint}>
          Check your event details before saving.
        </Text>
      </View>

      {/* CREATED EVENT AND QR CODE */}
      {payload && createdEvent && (
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <View style={styles.resultSuccessIcon}>
              <Ionicons
                name="checkmark-circle"
                size={30}
                color={COLORS.success}
              />
            </View>

            <Text style={styles.resultTitle}>Event Created Successfully</Text>
            <Text style={styles.resultSubtitle}>
              Your event has been saved. Students can scan this QR code to
              record attendance.
            </Text>
          </View>

          <View style={styles.eventInformation}>
            <InfoRow
              icon="barcode-outline"
              label="Event Code"
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

          <Text style={styles.qrHeading}>Event Attendance QR Code</Text>

          <View style={styles.qrBox}>
            <QRCode value={payload} size={200} />
          </View>

          <View style={styles.qrHint}>
            <Ionicons
              name="scan-outline"
              size={17}
              color={COLORS.textSecondary}
            />
            <Text style={styles.qrHintText}>
              Open the Scan tab to test this QR code.
            </Text>
          </View>

          <Text style={styles.payloadLabel}>QR PAYLOAD</Text>
          <Text selectable style={styles.payloadText}>
            {payload}
          </Text>
        </View>
      )}

      <Text style={styles.footerText}>
        QR Attendance · {isAdmin ? 'Administrator' : 'Teacher'} Workspace
      </Text>
    </ScrollView>
  );
}

function FieldLabel({
  title,
  required = false,
}: {
  title: string;
  required?: boolean;
}) {
  return (
    <Text style={styles.label}>
      {title}
      {required && <Text style={styles.required}> *</Text>}
    </Text>
  );
}

type PickerFieldProps = {
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
};

function PickerField({
  value,
  icon,
  onPress,
  disabled = false,
}: PickerFieldProps) {
  return (
    <Pressable
      disabled={disabled}
      style={({ pressed }) => [
        styles.pickerField,
        pressed && styles.pickerFieldPressed,
        disabled && styles.disabled,
      ]}
      onPress={onPress}
    >
      <View style={styles.pickerLeadingIcon}>
        <Ionicons name={icon} size={21} color={COLORS.primary} />
      </View>

      <Text style={styles.pickerValue}>{value}</Text>

      <Ionicons
        name="calendar-outline"
        size={19}
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
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={18} color={COLORS.primary} />
      </View>

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
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 36,
  },
  lockContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  lockIcon: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockTitle: {
    fontSize: 21,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 16,
    textAlign: 'center',
  },
  lockSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 21,
    marginTop: 8,
    textAlign: 'center',
  },
  pageHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  headingIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  headingText: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 19,
    marginTop: 4,
  },
  roleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
    gap: 11,
  },
  roleBannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleBannerContent: {
    flex: 1,
  },
  roleBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  roleBannerText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    lineHeight: 16,
    marginTop: 3,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
    gap: 10,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.textPrimary,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  sectionIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sectionHeadingText: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  sectionSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textSecondary,
    marginTop: 3,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 7,
    marginTop: 12,
  },
  required: {
    color: COLORS.danger,
  },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  descriptionInput: {
    minHeight: 115,
    paddingTop: 13,
  },
  fieldHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginTop: 7,
  },
  characterCount: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'right',
    marginTop: 6,
  },
  pickerField: {
    backgroundColor: COLORS.background,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickerFieldPressed: {
    backgroundColor: COLORS.surface,
  },
  pickerLeadingIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginHorizontal: 10,
    lineHeight: 19,
  },
  quickLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginTop: 17,
    marginBottom: 9,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: COLORS.surface,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipPressed: {
    opacity: 0.7,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  disabled: {
    opacity: 0.55,
  },
  pickerContainer: {
    marginTop: 14,
    alignItems: 'center',
    overflow: 'hidden',
  },
  messageBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 12,
    padding: 13,
    marginBottom: 14,
    gap: 9,
  },
  successMessage: {
    backgroundColor: '#E8F4EC',
  },
  errorMessage: {
    backgroundColor: '#FCEBE9',
  },
  messageText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  actionContainer: {
    marginBottom: 10,
  },
  savingIndicator: {
    marginTop: 10,
  },
  actionHint: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 10,
  },
  resultCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 18,
    marginTop: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  resultHeader: {
    alignItems: 'center',
    width: '100%',
    marginBottom: 18,
  },
  resultSuccessIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: '#E8F4EC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  resultSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 7,
  },
  eventInformation: {
    width: '100%',
    backgroundColor: COLORS.background,
    borderRadius: 14,
    padding: 12,
    marginBottom: 20,
  },
  eventInformationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 7,
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTextContainer: {
    flex: 1,
    marginLeft: 10,
    paddingTop: 1,
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textSecondary,
    marginBottom: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  eventInformationText: {
    fontSize: 13,
    color: COLORS.textPrimary,
    lineHeight: 19,
  },
  qrHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 14,
  },
  qrBox: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  qrHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 13,
    gap: 7,
  },
  qrHintText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    flexShrink: 1,
  },
  payloadLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 1,
    marginTop: 18,
    marginBottom: 6,
  },
  payloadText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 17,
  },
  footerText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 20,
  },
});