import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  type AttendanceRecord,
  getTeacherEventAttendance,
  type TeacherEventAttendance,
} from '@/lib/attendance';
import { deleteEvent, updateEvent } from '@/lib/events';
import { getProfile, type Role } from '@/lib/profiles';
import { buildQRPayload } from '@/lib/qr';

type EventStatus = 'Upcoming' | 'Ongoing' | 'Ended';

export default function HistoryScreen() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<Role | null>(null);

  const [studentRecords, setStudentRecords] =
    useState<AttendanceRecord[]>([]);

  const [teacherEvents, setTeacherEvents] =
    useState<TeacherEventAttendance[]>([]);

  const [expandedEventId, setExpandedEventId] =
    useState<string | null>(null);

  // EDIT EVENT
  const [editingEventId, setEditingEventId] =
    useState<string | null>(null);

  const [editTitle, setEditTitle] = useState('');
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editLocation, setEditLocation] = useState('');

  const [savingEdit, setSavingEdit] = useState(false);

  const [deletingEventId, setDeletingEventId] =
    useState<string | null>(null);

  // ============================================================
  // LOAD HISTORY
  // ============================================================

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const profile = await getProfile(user.id);
    const currentRole = profile?.role ?? 'student';

    setRole(currentRole);

    if (
      currentRole === 'teacher' ||
      currentRole === 'admin'
    ) {
      const events =
        await getTeacherEventAttendance(user.id);

      setTeacherEvents(events);
      setStudentRecords([]);
    } else {
      const records =
        await getAttendanceHistory(user.id);

      setStudentRecords(records);
      setTeacherEvents([]);
    }

    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // ============================================================
  // START EDITING
  // ============================================================

  const startEditing = (
    event: TeacherEventAttendance
  ) => {
    setEditingEventId(event.eventId);

    setEditTitle(event.title);

    setEditStart(
      event.startTime
        ? formatDateForInput(event.startTime)
        : ''
    );

    setEditEnd(
      event.endTime
        ? formatDateForInput(event.endTime)
        : ''
    );

    setEditLocation(
      event.location ?? ''
    );
  };

  // ============================================================
  // CANCEL EDITING
  // ============================================================

  const cancelEditing = () => {
    setEditingEventId(null);
    setEditTitle('');
    setEditStart('');
    setEditEnd('');
    setEditLocation('');
  };

  // ============================================================
  // SAVE EVENT EDIT
  // ============================================================

  const handleSaveEdit = async () => {
    if (!editingEventId) {
      return;
    }

    const title = editTitle.trim();
    const location = editLocation.trim();

    if (!title) {
      Alert.alert(
        'Missing Event Title',
        'Please enter an event title.'
      );
      return;
    }

    setSavingEdit(true);

    const { error } = await updateEvent(
      editingEventId,
      {
        title,
        start: editStart.trim(),
        end: editEnd.trim(),
        location,
      }
    );

    setSavingEdit(false);

    if (error) {
      Alert.alert(
        'Update Failed',
        error
      );
      return;
    }

    Alert.alert(
      'Event Updated',
      'The event has been updated successfully.'
    );

    cancelEditing();

    await load();
  };

  // ============================================================
  // DELETE EVENT
  // ============================================================

  const handleDeleteEvent = (
    event: TeacherEventAttendance
  ) => {
    Alert.alert(
      'Delete Event',
      `Are you sure you want to delete "${event.title}"?\n\nThis will also remove the event from the attendance history.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',

          onPress: async () => {
            setDeletingEventId(
              event.eventId
            );

            const { error } =
              await deleteEvent(
                event.eventId
              );

            setDeletingEventId(null);

            if (error) {
              Alert.alert(
                'Delete Failed',
                error
              );
              return;
            }

            if (
              expandedEventId ===
              event.eventId
            ) {
              setExpandedEventId(null);
            }

            if (
              editingEventId ===
              event.eventId
            ) {
              cancelEditing();
            }

            Alert.alert(
              'Event Deleted',
              'The event has been deleted successfully.'
            );

            await load();
          },
        },
      ]
    );
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

        <Text style={styles.loadingText}>
          Loading attendance history...
        </Text>
      </View>
    );
  }

  // ============================================================
  // TEACHER / ADMIN HISTORY
  // ============================================================

  if (
    role === 'teacher' ||
    role === 'admin'
  ) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>
          Attendance History
        </Text>

        <Text style={styles.subtitle}>
          View your event summaries, saved QR codes,
          attendance records, and event management
          options.
        </Text>

        {teacherEvents.length === 0 ? (
          <Text style={styles.emptyText}>
            No events created yet.
          </Text>
        ) : (
          teacherEvents.map((event) => {
            const expanded =
              expandedEventId ===
              event.eventId;

            const editing =
              editingEventId ===
              event.eventId;

            const status =
              getEventStatus(
                event.startTime,
                event.endTime
              );

            const sortedAttendees = [
              ...event.attendees,
            ].sort((a, b) => {
              const nameA =
                a.studentName
                  ?.trim()
                  .toLowerCase() || '';

              const nameB =
                b.studentName
                  ?.trim()
                  .toLowerCase() || '';

              return nameA.localeCompare(
                nameB
              );
            });

            return (
              <View
                key={event.eventId}
                style={styles.historyCard}
              >
                {/* ==================================================
                    EVENT SUMMARY HEADER
                    ================================================== */}

                <Pressable
                  onPress={() => {
                    setExpandedEventId(
                      expanded
                        ? null
                        : event.eventId
                    );

                    if (
                      editing &&
                      !expanded
                    ) {
                      cancelEditing();
                    }
                  }}
                  style={({ pressed }) => [
                    styles.historyHeader,
                    pressed &&
                      styles.pressed,
                  ]}
                >
                  <View
                    style={styles.historyIcon}
                  >
                    <Ionicons
                      name={
                        expanded
                          ? 'chevron-down'
                          : 'chevron-forward'
                      }
                      size={20}
                      color={
                        COLORS.primary
                      }
                    />
                  </View>

                  <View
                    style={styles.historyBody}
                  >
                    <Text
                      style={
                        styles.historyTitle
                      }
                    >
                      {event.title}
                    </Text>

                    <Text
                      style={
                        styles.historyMeta
                      }
                    >
                      Event Code:{' '}
                      {event.eventCode}
                    </Text>

                    <Text
                      style={
                        styles.historyMeta
                      }
                    >
                      {event.startTime
                        ? formatDate(
                            event.startTime
                          )
                        : 'No start time'}
                    </Text>

                    {event.location && (
                      <Text
                        style={
                          styles.historyMeta
                        }
                      >
                        Location:{' '}
                        {event.location}
                      </Text>
                    )}
                  </View>

                  {/* COUNT + STATUS */}

                  <View
                    style={
                      styles.countContainer
                    }
                  >
                    <View
                      style={
                        styles.countBadge
                      }
                    >
                      <Text
                        style={
                          styles.countValue
                        }
                      >
                        {
                          event.attendeeCount
                        }
                      </Text>

                      <Text
                        style={
                          styles.countLabel
                        }
                      >
                        {event.attendeeCount ===
                        1
                          ? 'student'
                          : 'students'}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.statusBadge,
                        status ===
                          'Upcoming' &&
                          styles.statusUpcoming,
                        status ===
                          'Ongoing' &&
                          styles.statusOngoing,
                        status ===
                          'Ended' &&
                          styles.statusEnded,
                      ]}
                    >
                      <View
                        style={[
                          styles.statusDot,
                          status ===
                            'Upcoming' &&
                            styles.statusDotUpcoming,
                          status ===
                            'Ongoing' &&
                            styles.statusDotOngoing,
                          status ===
                            'Ended' &&
                            styles.statusDotEnded,
                        ]}
                      />

                      <Text
                        style={[
                          styles.statusText,
                          status ===
                            'Upcoming' &&
                            styles.statusTextUpcoming,
                          status ===
                            'Ongoing' &&
                            styles.statusTextOngoing,
                          status ===
                            'Ended' &&
                            styles.statusTextEnded,
                        ]}
                      >
                        {status}
                      </Text>
                    </View>
                  </View>
                </Pressable>

                {/* ==================================================
                    EXPANDED EVENT
                    ================================================== */}

                {expanded && (
                  <View
                    style={
                      styles.expandedSection
                    }
                  >
                    {/* ==================================================
                        EVENT DETAILS
                        ================================================== */}

                    <View
                      style={
                        styles.detailsSection
                      }
                    >
                      <Text
                        style={
                          styles.detailsTitle
                        }
                      >
                        Event Details
                      </Text>

                      <View
                        style={
                          styles.detailRow
                        }
                      >
                        <Ionicons
                          name="calendar-outline"
                          size={18}
                          color={
                            COLORS.primary
                          }
                        />

                        <View
                          style={
                            styles.detailContent
                          }
                        >
                          <Text
                            style={
                              styles.detailLabel
                            }
                          >
                            Starts
                          </Text>

                          <Text
                            style={
                              styles.detailValue
                            }
                          >
                            {event.startTime
                              ? formatDate(
                                  event.startTime
                                )
                              : 'No start time'}
                          </Text>
                        </View>
                      </View>

                      <View
                        style={
                          styles.detailRow
                        }
                      >
                        <Ionicons
                          name="time-outline"
                          size={18}
                          color={
                            COLORS.primary
                          }
                        />

                        <View
                          style={
                            styles.detailContent
                          }
                        >
                          <Text
                            style={
                              styles.detailLabel
                            }
                          >
                            Ends
                          </Text>

                          <Text
                            style={
                              styles.detailValue
                            }
                          >
                            {event.endTime
                              ? formatDate(
                                  event.endTime
                                )
                              : 'No end time'}
                          </Text>
                        </View>
                      </View>

                      <View
                        style={
                          styles.detailRow
                        }
                      >
                        <Ionicons
                          name="location-outline"
                          size={18}
                          color={
                            COLORS.primary
                          }
                        />

                        <View
                          style={
                            styles.detailContent
                          }
                        >
                          <Text
                            style={
                              styles.detailLabel
                            }
                          >
                            Location
                          </Text>

                          <Text
                            style={
                              styles.detailValue
                            }
                          >
                            {event.location ||
                              'No location specified'}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* ==================================================
                        QR CODE

                        IMPORTANT:
                        This uses buildQRPayload()
                        instead of event.eventCode.
                        Therefore it contains the same
                        JSON payload format as the QR
                        generated by Teacher.
                        ================================================== */}

                    <View
                      style={styles.qrSection}
                    >
                      <Text
                        style={styles.qrTitle}
                      >
                        Event QR Code
                      </Text>

                      <Text
                        style={
                          styles.qrDescription
                        }
                      >
                        This is the attendance QR
                        code for this event. It can
                        be scanned using the Scan tab.
                      </Text>

                      <View
                        style={
                          styles.qrContainer
                        }
                      >
                        <QRCode
                          value={buildQRPayload(
                            {
                              eventId:
                                event.eventCode,
                              title:
                                event.title,
                              start:
                                event.startTime ??
                                undefined,
                              end:
                                event.endTime ??
                                undefined,
                            }
                          )}
                          size={190}
                          backgroundColor="#FFFFFF"
                        />
                      </View>

                      <Text
                        style={
                          styles.qrCodeText
                        }
                      >
                        {event.eventCode}
                      </Text>
                    </View>

                    {/* ==================================================
                        EDIT / DELETE
                        ================================================== */}

                    <View
                      style={styles.manageRow}
                    >
                      <Pressable
                        onPress={() =>
                          editing
                            ? cancelEditing()
                            : startEditing(
                                event
                              )
                        }
                        style={({ pressed }) => [
                          styles.editButton,
                          pressed &&
                            styles.buttonPressed,
                        ]}
                      >
                        <Ionicons
                          name={
                            editing
                              ? 'close-outline'
                              : 'create-outline'
                          }
                          size={18}
                          color="#fff"
                        />

                        <Text
                          style={
                            styles.actionButtonText
                          }
                        >
                          {editing
                            ? 'Cancel'
                            : 'Edit Event'}
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={() =>
                          handleDeleteEvent(
                            event
                          )
                        }
                        disabled={
                          deletingEventId ===
                          event.eventId
                        }
                        style={({ pressed }) => [
                          styles.deleteButton,
                          pressed &&
                            styles.buttonPressed,
                          deletingEventId ===
                            event.eventId &&
                            styles.disabledButton,
                        ]}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={18}
                          color="#fff"
                        />

                        <Text
                          style={
                            styles.actionButtonText
                          }
                        >
                          {deletingEventId ===
                          event.eventId
                            ? 'Deleting...'
                            : 'Delete Event'}
                        </Text>
                      </Pressable>
                    </View>

                    {/* ==================================================
                        EDIT FORM
                        ================================================== */}

                    {editing && (
                      <View
                        style={
                          styles.editBox
                        }
                      >
                        <Text
                          style={
                            styles.editTitle
                          }
                        >
                          Edit Event
                        </Text>

                        <Text
                          style={
                            styles.inputLabel
                          }
                        >
                          Event Title
                        </Text>

                        <TextInput
                          value={editTitle}
                          onChangeText={
                            setEditTitle
                          }
                          placeholder="Event title"
                          placeholderTextColor={
                            COLORS.textSecondary
                          }
                          style={
                            styles.input
                          }
                        />

                        <Text
                          style={
                            styles.inputLabel
                          }
                        >
                          Location
                        </Text>

                        <TextInput
                          value={
                            editLocation
                          }
                          onChangeText={
                            setEditLocation
                          }
                          placeholder="e.g. Main Gymnasium"
                          placeholderTextColor={
                            COLORS.textSecondary
                          }
                          style={
                            styles.input
                          }
                        />

                        <Text
                          style={
                            styles.inputLabel
                          }
                        >
                          Start Time
                        </Text>

                        <TextInput
                          value={
                            editStart
                          }
                          onChangeText={
                            setEditStart
                          }
                          placeholder="YYYY-MM-DD HH:MM"
                          placeholderTextColor={
                            COLORS.textSecondary
                          }
                          style={
                            styles.input
                          }
                        />

                        <Text
                          style={
                            styles.inputHint
                          }
                        >
                          Example:
                          2026-10-12 08:00
                        </Text>

                        <Text
                          style={
                            styles.inputLabel
                          }
                        >
                          End Time
                        </Text>

                        <TextInput
                          value={editEnd}
                          onChangeText={
                            setEditEnd
                          }
                          placeholder="YYYY-MM-DD HH:MM"
                          placeholderTextColor={
                            COLORS.textSecondary
                          }
                          style={
                            styles.input
                          }
                        />

                        <Text
                          style={
                            styles.inputHint
                          }
                        >
                          Example:
                          2026-10-12 10:00
                        </Text>

                        <Pressable
                          onPress={
                            handleSaveEdit
                          }
                          disabled={
                            savingEdit
                          }
                          style={[
                            styles.saveButton,
                            savingEdit &&
                              styles.disabledButton,
                          ]}
                        >
                          <Text
                            style={
                              styles.saveButtonText
                            }
                          >
                            {savingEdit
                              ? 'Saving...'
                              : 'Save Changes'}
                          </Text>
                        </Pressable>
                      </View>
                    )}

                    {/* ==================================================
                        ATTENDANCE LIST
                        ================================================== */}

                    <View
                      style={
                        styles.attendanceSection
                      }
                    >
                      <View
                        style={
                          styles.attendanceSectionHeader
                        }
                      >
                        <Text
                          style={
                            styles.attendanceSectionTitle
                          }
                        >
                          Students Attended
                        </Text>

                        <Text
                          style={
                            styles.alphabetical
                          }
                        >
                          A–Z
                        </Text>
                      </View>

                      {sortedAttendees.length ===
                      0 ? (
                        <Text
                          style={
                            styles.noStudents
                          }
                        >
                          No students have attended
                          this event yet.
                        </Text>
                      ) : (
                        sortedAttendees.map(
                          (
                            attendee,
                            index
                          ) => (
                            <View
                              key={`${event.eventId}-${attendee.studentId}`}
                              style={
                                styles.studentRow
                              }
                            >
                              <View
                                style={
                                  styles.numberCircle
                                }
                              >
                                <Text
                                  style={
                                    styles.numberText
                                  }
                                >
                                  {index + 1}
                                </Text>
                              </View>

                              <View
                                style={
                                  styles.studentInfo
                                }
                              >
                                <Text
                                  style={
                                    styles.studentName
                                  }
                                >
                                  {attendee.studentName ||
                                    `Student ${attendee.studentId.slice(
                                      -8
                                    )}`}
                                </Text>

                                <Text
                                  style={
                                    styles.studentTime
                                  }
                                >
                                  Attended at{' '}
                                  {formatDate(
                                    attendee.scannedAt
                                  )}
                                </Text>
                              </View>
                            </View>
                          )
                        )
                      )}
                    </View>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    );
  }

  // ============================================================
  // STUDENT HISTORY
  // ============================================================

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Attendance History
      </Text>

      {studentRecords.length === 0 ? (
        <Text
          style={
            styles.emptyStudentText
          }
        >
          No records yet. Scan a QR code to
          register your attendance.
        </Text>
      ) : (
        <ScrollView
          contentContainerStyle={
            styles.content
          }
          showsVerticalScrollIndicator={
            false
          }
        >
          {studentRecords.map((item) => (
            <View
              key={String(item.id)}
              style={
                styles.studentHistoryCard
              }
            >
              <Text
                style={styles.eventTitle}
              >
                {item.eventTitle}
              </Text>

              <Text
                style={styles.eventMeta}
              >
                Event Code: {item.eventId}
              </Text>

              <Text
                style={styles.eventMeta}
              >
                Attended:{' '}
                {formatDate(
                  item.scannedAt
                )}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ============================================================
// EVENT STATUS
// ============================================================

function getEventStatus(
  startTime: string | null,
  endTime: string | null
): EventStatus {
  const now = new Date();

  if (!startTime) {
    return 'Upcoming';
  }

  const start = new Date(
    startTime
  );

  if (now < start) {
    return 'Upcoming';
  }

  if (endTime) {
    const end = new Date(
      endTime
    );

    if (now <= end) {
      return 'Ongoing';
    }
  }

  return 'Ended';
}

// ============================================================
// DATE FORMATTERS
// ============================================================

function formatDate(
  iso: string
) {
  return new Date(
    iso
  ).toLocaleString();
}

function formatDateForInput(
  iso: string
) {
  const date = new Date(iso);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '';
  }

  const year =
    date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, '0');

  const day = String(
    date.getDate()
  ).padStart(2, '0');

  const hours = String(
    date.getHours()
  ).padStart(2, '0');

  const minutes = String(
    date.getMinutes()
  ).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor:
      COLORS.background,
    paddingHorizontal: 24,
    paddingTop: 24,
  },

  content: {
    paddingBottom: 40,
  },

  center: {
    flex: 1,
    backgroundColor:
      COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },

  loadingText: {
    color:
      COLORS.textSecondary,
    marginTop: 10,
    fontSize: 14,
  },

  title: {
    fontSize: 20,
    fontWeight: '600',
    color:
      COLORS.textPrimary,
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 14,
    color:
      COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 18,
  },

  emptyText: {
    fontSize: 14,
    color:
      COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 30,
    lineHeight: 20,
  },

  emptyStudentText: {
    fontSize: 14,
    color:
      COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 32,
    paddingHorizontal: 20,
  },

  // ============================================================
  // EVENT CARD
  // ============================================================

  historyCard: {
    backgroundColor:
      COLORS.card,
    borderWidth: 1,
    borderColor:
      COLORS.border,
    borderRadius: 14,
    marginBottom: 12,
    overflow: 'hidden',
  },

  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },

  pressed: {
    opacity: 0.7,
  },

  historyIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor:
      COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  historyBody: {
    flex: 1,
  },

  historyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color:
      COLORS.textPrimary,
  },

  historyMeta: {
    fontSize: 12,
    color:
      COLORS.textSecondary,
    marginTop: 4,
  },

  // ============================================================
  // COUNT + STATUS
  // ============================================================

  countContainer: {
    alignItems: 'center',
    marginLeft: 8,
  },

  countBadge: {
    minWidth: 62,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor:
      COLORS.surface,
    alignItems: 'center',
  },

  countValue: {
    fontSize: 18,
    fontWeight: '800',
    color:
      COLORS.primary,
  },

  countLabel: {
    fontSize: 9,
    color:
      COLORS.textSecondary,
    marginTop: 1,
  },

  statusBadge: {
    marginTop: 5,
    minWidth: 62,
    paddingVertical: 4,
    paddingHorizontal: 7,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  statusUpcoming: {
    backgroundColor: COLORS.primary + '33', // 20% opacity
  },

  statusOngoing: {
    backgroundColor:
      '#ECFDF5',
  },

  statusEnded: {
    backgroundColor:
      '#F3F4F6',
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },

  statusDotUpcoming: {
    backgroundColor: COLORS.warning,
  },

  statusDotOngoing: {
    backgroundColor:
      '#16A34A',
  },

  statusDotEnded: {
    backgroundColor:
      '#6B7280',
  },

  statusText: {
    fontSize: 9,
    fontWeight: '700',
  },

  statusTextUpcoming: {
    color: COLORS.warning,
  },

  statusTextOngoing: {
    color: '#16A34A',
  },

  statusTextEnded: {
    color: '#6B7280',
  },

  // ============================================================
  // EXPANDED SECTION
  // ============================================================

  expandedSection: {
    borderTopWidth: 1,
    borderTopColor:
      COLORS.border,
  },

  // ============================================================
  // EVENT DETAILS
  // ============================================================

  detailsSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor:
      COLORS.border,
  },

  detailsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color:
      COLORS.textPrimary,
    marginBottom: 12,
  },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  detailContent: {
    flex: 1,
    marginLeft: 10,
  },

  detailLabel: {
    fontSize: 11,
    fontWeight: '600',
    color:
      COLORS.textSecondary,
    marginBottom: 2,
  },

  detailValue: {
    fontSize: 13,
    color:
      COLORS.textPrimary,
  },

  // ============================================================
  // QR
  // ============================================================

  qrSection: {
    alignItems: 'center',
    padding: 18,
  },

  qrTitle: {
    fontSize: 17,
    fontWeight: '700',
    color:
      COLORS.textPrimary,
    marginBottom: 5,
  },

  qrDescription: {
    fontSize: 12,
    lineHeight: 18,
    color:
      COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 14,
    maxWidth: 300,
  },

  qrContainer: {
    backgroundColor:
      '#FFFFFF',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor:
      '#E5E7EB',
  },

  qrCodeText: {
    fontSize: 13,
    fontWeight: '700',
    color:
      COLORS.textPrimary,
    marginTop: 10,
    letterSpacing: 1,
  },

  // ============================================================
  // BUTTONS
  // ============================================================

  manageRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 10,
  },

  editButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor:
      COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },

  deleteButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor:
      '#dc2626',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },

  actionButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
  },

  buttonPressed: {
    opacity: 0.7,
  },

  disabledButton: {
    opacity: 0.5,
  },

  // ============================================================
  // EDIT BOX
  // ============================================================

  editBox: {
    margin: 14,
    padding: 14,
    borderRadius: 12,
    backgroundColor:
      COLORS.surface,
    borderWidth: 1,
    borderColor:
      COLORS.border,
  },

  editTitle: {
    fontSize: 16,
    fontWeight: '700',
    color:
      COLORS.textPrimary,
    marginBottom: 12,
  },

  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color:
      COLORS.textSecondary,
    marginBottom: 6,
    marginTop: 8,
  },

  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor:
      COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    color:
      COLORS.textPrimary,
    backgroundColor:
      COLORS.card,
    fontSize: 14,
  },

  inputHint: {
    fontSize: 10,
    color:
      COLORS.textSecondary,
    marginTop: 4,
  },

  saveButton: {
    height: 46,
    borderRadius: 10,
    backgroundColor:
      COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },

  saveButtonText: {
    color:
      COLORS.textOnPrimary,
    fontSize: 14,
    fontWeight: '700',
  },

  // ============================================================
  // ATTENDANCE
  // ============================================================

  attendanceSection: {
    paddingHorizontal: 14,
    paddingBottom: 8,
  },

  attendanceSectionHeader: {
    flexDirection: 'row',
    justifyContent:
      'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },

  attendanceSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color:
      COLORS.textPrimary,
  },

  alphabetical: {
    fontSize: 11,
    fontWeight: '700',
    color:
      COLORS.primary,
  },

  noStudents: {
    fontSize: 13,
    color:
      COLORS.textSecondary,
    paddingVertical: 12,
  },

  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor:
      COLORS.border,
  },

  numberCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor:
      COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  numberText: {
    fontSize: 12,
    fontWeight: '700',
    color:
      COLORS.textSecondary,
  },

  studentInfo: {
    flex: 1,
  },

  studentName: {
    fontSize: 14,
    fontWeight: '600',
    color:
      COLORS.textPrimary,
  },

  studentTime: {
    fontSize: 11,
    color:
      COLORS.textSecondary,
    marginTop: 3,
  },

  // ============================================================
  // STUDENT HISTORY
  // ============================================================

  studentHistoryCard: {
    backgroundColor:
      COLORS.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor:
      COLORS.border,
  },

  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color:
      COLORS.textPrimary,
    marginBottom: 5,
  },

  eventMeta: {
    fontSize: 13,
    color:
      COLORS.textSecondary,
    marginTop: 3,
  },
});