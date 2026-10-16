
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppButton from '@/components/AppButton';
import Header from '@/components/Header';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { getProfile } from '@/lib/profiles';
import {
  getAnnouncements,
  markAnnouncementAsRead,
  type Announcement,
} from '@/lib/announcements';
import {
  getAvailableEvents,
  type CloudEvent,
} from '@/lib/events';

type UserRole = 'student' | 'teacher' | 'admin';

export default function Index() {
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const scrollViewRef = useRef<ScrollView>(null);
  const [eventsSectionY, setEventsSectionY] = useState(0);

  const [role, setRole] = useState<UserRole>('student');
  const [loadingRole, setLoadingRole] = useState(true);

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
  const [announcementError, setAnnouncementError] = useState('');
  const [readingId, setReadingId] = useState<string | null>(null);

  const [events, setEvents] = useState<CloudEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [eventError, setEventError] = useState('');

  const isSmallScreen = width < 380;

  const loadDashboard = useCallback(async () => {
    setLoadingRole(true);
    setLoadingAnnouncements(true);
    setLoadingEvents(true);
    setAnnouncementError('');
    setEventError('');

    if (!user) {
      setRole('student');
      setAnnouncements([]);
      setEvents([]);
      setLoadingRole(false);
      setLoadingAnnouncements(false);
      setLoadingEvents(false);
      return;
    }

    try {
      const profile = await getProfile(user.id);

      const profileRole: UserRole =
        profile?.role === 'admin'
          ? 'admin'
          : profile?.role === 'teacher'
            ? 'teacher'
            : 'student';

      setRole(profileRole);

      const [announcementResult, eventResult] = await Promise.all([
        getAnnouncements(user.id, profileRole),
        getAvailableEvents(),
      ]);

      setAnnouncements(announcementResult.data ?? []);

      if (announcementResult.error) {
        setAnnouncementError(
          'Unable to load announcements. Please try again.',
        );
      }

      setEvents(eventResult.events);

      if (eventResult.error) {
        setEventError(
          'Unable to load school events. Please try again.',
        );
      }
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      setAnnouncementError(
        'Unable to load announcements. Check your connection and try again.',
      );
      setEventError(
        'Unable to load school events. Please try again.',
      );
    } finally {
      setLoadingRole(false);
      setLoadingAnnouncements(false);
      setLoadingEvents(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void loadDashboard();
    }, [loadDashboard]),
  );

  const isAdministrator = role === 'admin';
  const isTeacher = role === 'teacher';

  const welcomeTitle = isAdministrator
    ? 'School Overview'
    : isTeacher
      ? 'Manage Your Events'
      : 'Welcome Back!';

  const welcomeMessage = isAdministrator
    ? 'Manage school activities and keep everyone informed.'
    : isTeacher
      ? 'Create events, generate QR codes, and monitor attendance.'
      : 'Stay updated with school activities and keep your attendance organized.';

  const handleAnnouncementPress = async (
    announcement: Announcement,
  ) => {
    if (!user || readingId) return;

    if (announcement.is_read) {
      Alert.alert(announcement.title, announcement.message);
      return;
    }

    setReadingId(announcement.id);

    try {
      const result = await markAnnouncementAsRead(
        announcement.id,
        user.id,
      );

      if (result.error) {
        Alert.alert(
          'Could not mark as read',
          'The announcement will open, but its read status could not be saved.',
        );
      } else {
        setAnnouncements((current) =>
          current.map((item) =>
            item.id === announcement.id
              ? { ...item, is_read: true }
              : item,
          ),
        );
      }

      Alert.alert(announcement.title, announcement.message);
    } catch (error) {
      console.error('Failed to mark announcement as read:', error);
      Alert.alert(announcement.title, announcement.message);
    } finally {
      setReadingId(null);
    }
  };

  const formatAnnouncementDate = (dateString: string | null) => {
    if (!dateString) return 'Date unavailable';

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
      return 'Date unavailable';
    }

    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatEventDate = (dateString: string | null) => {
    if (!dateString) return 'Schedule to be announced';

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
      return 'Schedule unavailable';
    }

    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const refreshDashboard = () => {
    void loadDashboard();
  };

  const scrollToEvents = () => {
    scrollViewRef.current?.scrollTo({
      y: Math.max(eventsSectionY - 10, 0),
      animated: true,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerContainer}>
          <Header title="QR Attendance" />
        </View>

        {/* WELCOME CARD */}
        <View style={styles.welcomeCard}>
          <View style={styles.welcomeTopRow}>
            <View style={styles.welcomeIcon}>
              <Ionicons
                name={
                  isAdministrator
                    ? 'shield-checkmark-outline'
                    : isTeacher
                      ? 'school-outline'
                      : 'person-outline'
                }
                size={24}
                color={COLORS.surface}
              />
            </View>

            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>
                {loadingRole
                  ? 'LOADING'
                  : isAdministrator
                    ? 'ADMINISTRATOR'
                    : isTeacher
                      ? 'TEACHER'
                      : 'STUDENT'}
              </Text>
            </View>
          </View>

          <Text style={styles.welcomeEyebrow}>YOUR DASHBOARD</Text>
          <Text style={styles.welcomeTitle}>{welcomeTitle}</Text>
          <Text style={styles.welcomeMessage}>{welcomeMessage}</Text>

          {loadingRole && (
            <ActivityIndicator
              size="small"
              color={COLORS.surface}
              style={styles.loadingIndicator}
            />
          )}
        </View>

        {/* QUICK ACTION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Action</Text>

          <View style={styles.scanCard}>
            <View style={styles.scanIconContainer}>
              <Ionicons
                name="qr-code-outline"
                size={28}
                color={COLORS.textPrimary}
              />
            </View>

            <View style={styles.scanTextContainer}>
              <Text style={styles.scanTitle}>
                {isTeacher
                  ? 'Event QR Management'
                  : isAdministrator
                    ? 'Attendance Access'
                    : 'Scan Event QR Code'}
              </Text>

              <Text style={styles.scanDescription}>
                {isTeacher
                  ? 'Manage your event QR codes.'
                  : isAdministrator
                    ? 'Open the attendance scanner.'
                    : 'Record attendance at school activities.'}
              </Text>
            </View>
          </View>

          <AppButton
            theme="primary"
            title={
              isTeacher
                ? 'Manage Events'
                : isAdministrator
                  ? 'Open Attendance Scanner'
                  : 'Scan QR Code'
            }
            icon={isTeacher ? 'calendar-outline' : 'qr-code-outline'}
            onPress={() => {
              if (isTeacher) {
                router.push('/teacher');
              } else {
                router.push('/scan');
              }
            }}
          />
        </View>

        {/* ROLE-BASED SHORTCUTS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {isAdministrator
              ? 'Administration'
              : isTeacher
                ? 'Teacher Workspace'
                : 'My Attendance'}
          </Text>

          <View style={styles.shortcutGrid}>
            {isAdministrator ? (
              <>
                <ShortcutCard
                  compact={isSmallScreen}
                  icon="shield-checkmark-outline"
                  title="Admin Dashboard"
                  description="Manage school activities"
                  onPress={() => router.push('/administrator')}
                />

                <ShortcutCard
                  compact={isSmallScreen}
                  icon="megaphone-outline"
                  title="Announcements"
                  description="Create and publish school notices"
                  onPress={() =>
                    router.push('/administrator/announcements')
                  }
                />

                <ShortcutCard
                  compact={isSmallScreen}
                  icon="time-outline"
                  title="Attendance History"
                  description="Review attendance records"
                  onPress={() => router.push('/history')}
                />

                <ShortcutCard
                  compact={isSmallScreen}
                  icon="calendar-outline"
                  title="School Events"
                  description="Access event management"
                  onPress={() => router.push('/administrator')}
                />

                <ShortcutCard
                  compact={isSmallScreen}
                  icon="person-outline"
                  title="My Profile"
                  description="View your account"
                  onPress={() => router.push('/profile')}
                />
              </>
            ) : isTeacher ? (
              <>
                <ShortcutCard
                  compact={isSmallScreen}
                  icon="calendar-outline"
                  title="Manage Events"
                  description="Create and manage events"
                  onPress={() => router.push('/teacher')}
                />

                <ShortcutCard
                  compact={isSmallScreen}
                  icon="megaphone-outline"
                  title="Announcements"
                  description="Create and publish school notices"
                  onPress={() =>
                    router.push('/administrator/announcements')
                  }
                />

                <ShortcutCard
                  compact={isSmallScreen}
                  icon="qr-code-outline"
                  title="QR Scanner"
                  description="Scan an event QR code"
                  onPress={() => router.push('/scan')}
                />

                <ShortcutCard
                  compact={isSmallScreen}
                  icon="time-outline"
                  title="Attendance History"
                  description="View attendance records"
                  onPress={() => router.push('/history')}
                />

                <ShortcutCard
                  compact={isSmallScreen}
                  icon="person-outline"
                  title="My Profile"
                  description="View your account"
                  onPress={() => router.push('/profile')}
                />
              </>
            ) : (
              <>
                <ShortcutCard
                  compact={isSmallScreen}
                  icon="qr-code-outline"
                  title="Scan QR Code"
                  description="Record your attendance"
                  onPress={() => router.push('/scan')}
                />

                <ShortcutCard
                  compact={isSmallScreen}
                  icon="time-outline"
                  title="My History"
                  description="Review your attendance"
                  onPress={() => router.push('/history')}
                />

                <ShortcutCard
                  compact={isSmallScreen}
                  icon="calendar-outline"
                  title="School Events"
                  description="Check available school events"
                  onPress={scrollToEvents}
                />

                <ShortcutCard
                  compact={isSmallScreen}
                  icon="person-outline"
                  title="My Profile"
                  description="Manage your account"
                  onPress={() => router.push('/profile')}
                />
              </>
            )}
          </View>
        </View>

        {/* SCHOOL EVENTS FEED */}
        <View
          style={styles.section}
          onLayout={(event) =>
            setEventsSectionY(event.nativeEvent.layout.y)
          }
        >
          <View style={styles.announcementHeader}>
            <View style={styles.announcementHeading}>
              <Ionicons
                name="calendar-outline"
                size={20}
                color={COLORS.primary}
              />
              <Text style={styles.sectionTitle}>School Events</Text>
            </View>

            {!loadingEvents && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>
                  {events.length} available
                </Text>
              </View>
            )}
          </View>

          {loadingEvents ? (
            <View style={styles.announcementStateCard}>
              <ActivityIndicator
                size="small"
                color={COLORS.primary}
              />
              <Text style={styles.stateText}>
                Loading school events...
              </Text>
            </View>
          ) : eventError ? (
            <View style={styles.announcementStateCard}>
              <Ionicons
                name="alert-circle-outline"
                size={25}
                color={COLORS.danger}
              />
              <Text style={styles.stateText}>{eventError}</Text>

              <Pressable
                style={styles.retryButton}
                onPress={refreshDashboard}
              >
                <Text style={styles.retryButtonText}>Try again</Text>
              </Pressable>
            </View>
          ) : events.length === 0 ? (
            <View style={styles.announcementStateCard}>
              <View style={styles.emptyAnnouncementIcon}>
                <Ionicons
                  name="calendar-clear-outline"
                  size={25}
                  color={COLORS.primary}
                />
              </View>

              <Text style={styles.emptyAnnouncementTitle}>
                No available events
              </Text>

              <Text style={styles.stateText}>
                Events created by teachers and administrators will
                appear here when they are available.
              </Text>
            </View>
          ) : (
            events.map((event) => (
              <View key={event.id} style={styles.announcementCard}>
                <View style={styles.announcementIcon}>
                  <Ionicons
                    name="calendar"
                    size={22}
                    color={COLORS.primary}
                  />
                </View>

                <View style={styles.announcementContent}>
                  <Text style={styles.announcementTitle}>
                    {event.title}
                  </Text>

                  {!!event.description && (
                    <Text
                      style={styles.announcementDescription}
                      numberOfLines={3}
                    >
                      {event.description}
                    </Text>
                  )}

                  <View style={styles.eventDetailRow}>
                    <Ionicons
                      name="time-outline"
                      size={14}
                      color={COLORS.textSecondary}
                    />
                    <Text style={styles.announcementDate}>
                      Starts: {formatEventDate(event.start_time)}
                    </Text>
                  </View>

                  {event.end_time && (
                    <View style={styles.eventDetailRow}>
                      <Ionicons
                        name="checkmark-circle-outline"
                        size={14}
                        color={COLORS.textSecondary}
                      />
                      <Text style={styles.announcementDate}>
                        Ends: {formatEventDate(event.end_time)}
                      </Text>
                    </View>
                  )}

                  {!!event.location && (
                    <View style={styles.eventDetailRow}>
                      <Ionicons
                        name="location-outline"
                        size={14}
                        color={COLORS.textSecondary}
                      />
                      <Text style={styles.announcementDate}>
                        {event.location}
                      </Text>
                    </View>
                  )}

                  <Text style={styles.eventCode}>
                    Event code: {event.event_code}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* ANNOUNCEMENTS FEED */}
        <View style={styles.section}>
          <View style={styles.announcementHeader}>
            <View style={styles.announcementHeading}>
              <Ionicons
                name="megaphone-outline"
                size={20}
                color={COLORS.primary}
              />
              <Text style={styles.sectionTitle}>Announcements</Text>
            </View>

            {!loadingAnnouncements && announcements.length > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>
                  {announcements.filter((item) => !item.is_read).length}{' '}
                  unread
                </Text>
              </View>
            )}
          </View>

          {loadingAnnouncements ? (
            <View style={styles.announcementStateCard}>
              <ActivityIndicator
                size="small"
                color={COLORS.primary}
              />
              <Text style={styles.stateText}>
                Loading announcements...
              </Text>
            </View>
          ) : announcementError ? (
            <View style={styles.announcementStateCard}>
              <Ionicons
                name="alert-circle-outline"
                size={25}
                color={COLORS.danger}
              />
              <Text style={styles.stateText}>
                {announcementError}
              </Text>

              <Pressable
                style={styles.retryButton}
                onPress={refreshDashboard}
              >
                <Text style={styles.retryButtonText}>Try again</Text>
              </Pressable>
            </View>
          ) : announcements.length === 0 ? (
            <View style={styles.announcementStateCard}>
              <View style={styles.emptyAnnouncementIcon}>
                <Ionicons
                  name="notifications-off-outline"
                  size={25}
                  color={COLORS.primary}
                />
              </View>

              <Text style={styles.emptyAnnouncementTitle}>
                No announcements yet
              </Text>

              <Text style={styles.stateText}>
                School notices, event reminders, and important updates
                will appear here when published by the administrator or
                authorized teacher.
              </Text>
            </View>
          ) : (
            announcements.map((announcement) => (
              <Pressable
                key={announcement.id}
                style={({ pressed }) => [
                  styles.announcementCard,
                  !announcement.is_read &&
                    styles.unreadAnnouncementCard,
                  pressed && styles.announcementPressed,
                ]}
                onPress={() =>
                  void handleAnnouncementPress(announcement)
                }
                disabled={readingId !== null}
              >
                <View style={styles.announcementIcon}>
                  <Ionicons
                    name={
                      announcement.is_read
                        ? 'notifications-outline'
                        : 'notifications'
                    }
                    size={22}
                    color={COLORS.primary}
                  />
                </View>

                <View style={styles.announcementContent}>
                  <View style={styles.announcementTitleRow}>
                    <Text style={styles.announcementTitle}>
                      {announcement.title}
                    </Text>

                    {!announcement.is_read && (
                      <View style={styles.unreadDot} />
                    )}
                  </View>

                  <Text
                    style={styles.announcementDescription}
                    numberOfLines={3}
                  >
                    {announcement.message}
                  </Text>

                  <View style={styles.announcementMeta}>
                    <Ionicons
                      name="calendar-outline"
                      size={12}
                      color={COLORS.textSecondary}
                    />

                    <Text style={styles.announcementDate}>
                      {formatAnnouncementDate(
                        announcement.published_at,
                      )}
                    </Text>

                    <Text style={styles.metaSeparator}>•</Text>

                    <Text style={styles.announcementReadStatus}>
                      {announcement.is_read ? 'Read' : 'Unread'}
                    </Text>
                  </View>
                </View>

                {readingId === announcement.id ? (
                  <ActivityIndicator
                    size="small"
                    color={COLORS.primary}
                  />
                ) : (
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={COLORS.textSecondary}
                  />
                )}
              </Pressable>
            ))
          )}
        </View>

        {/* FOOTER */}
        <View style={styles.footer}>
          <Ionicons
            name="heart-outline"
            size={14}
            color={COLORS.textSecondary}
          />
          <Text style={styles.footerText}>School Event Attendance</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type ShortcutCardProps = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  description: string;
  onPress: () => void;
  compact: boolean;
};

function ShortcutCard({
  icon,
  title,
  description,
  onPress,
  compact,
}: ShortcutCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${description}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.shortcutCard,
        compact && styles.shortcutCardCompact,
        pressed && styles.shortcutPressed,
      ]}
    >
      <View style={styles.shortcutIcon}>
        <Ionicons
          name={icon}
          size={21}
          color={COLORS.primary}
        />
      </View>

      <Text style={styles.shortcutTitle}>{title}</Text>
      <Text style={styles.shortcutDescription}>{description}</Text>

      <View style={styles.shortcutAction}>
        <Text style={styles.shortcutActionText}>Open</Text>
        <Ionicons
          name="arrow-forward"
          size={13}
          color={COLORS.primary}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 24,
  },
  headerContainer: {
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  welcomeCard: {
    backgroundColor: COLORS.textSecondary,
    borderRadius: 20,
    padding: 18,
    marginBottom: 22,
    overflow: 'hidden',
  },
  welcomeTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  welcomeIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleBadge: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  roleBadgeText: {
    color: COLORS.textSecondary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  welcomeEyebrow: {
    color: COLORS.surface,
    opacity: 0.85,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 7,
  },
  welcomeTitle: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '800',
    marginBottom: 7,
  },
  welcomeMessage: {
    color: COLORS.background,
    fontSize: 13,
    lineHeight: 19,
    maxWidth: 300,
  },
  loadingIndicator: {
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  section: {
    marginBottom: 22,
  },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 11,
  },
  scanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 13,
    marginBottom: 12,
    gap: 11,
  },
  scanIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanTextContainer: {
    flex: 1,
  },
  scanTitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  scanDescription: {
    color: COLORS.textSecondary,
    fontSize: 11,
    lineHeight: 16,
  },
  shortcutGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  shortcutCard: {
    width: '48.5%',
    backgroundColor: COLORS.card,
    borderRadius: 15,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.surface,
    marginBottom: 10,
  },
  shortcutCardCompact: {
    padding: 10,
  },
  shortcutPressed: {
    opacity: 0.75,
  },
  shortcutIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 9,
  },
  shortcutTitle: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  shortcutDescription: {
    color: COLORS.textSecondary,
    fontSize: 10,
    lineHeight: 14,
    minHeight: 28,
  },
  shortcutAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
  },
  shortcutActionText: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: '700',
  },
  announcementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  announcementHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flex: 1,
  },
  countBadge: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 20,
  },
  countBadgeText: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '800',
  },
  announcementCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.card,
    borderRadius: 15,
    padding: 13,
    borderWidth: 1,
    borderColor: COLORS.surface,
    gap: 10,
    marginBottom: 9,
  },
  unreadAnnouncementCard: {
    borderColor: COLORS.primary,
  },
  announcementPressed: {
    opacity: 0.75,
  },
  announcementIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  announcementContent: {
    flex: 1,
  },
  announcementTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 4,
  },
  announcementTitle: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  announcementDescription: {
    color: COLORS.textSecondary,
    fontSize: 11,
    lineHeight: 17,
  },
  announcementMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 9,
  },
  announcementDate: {
    color: COLORS.textSecondary,
    fontSize: 10,
  },
  metaSeparator: {
    color: COLORS.textSecondary,
    fontSize: 10,
  },
  announcementReadStatus: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: '700',
  },
  announcementStateCard: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 15,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.surface,
    gap: 9,
  },
  emptyAnnouncementIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyAnnouncementTitle: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  stateText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    marginTop: 4,
  },
  retryButtonText: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '800',
  },
  eventDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 7,
  },
  eventCode: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 9,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 2,
    paddingVertical: 10,
  },
  footerText: {
    color: COLORS.textSecondary,
    fontSize: 10,
  },
});
