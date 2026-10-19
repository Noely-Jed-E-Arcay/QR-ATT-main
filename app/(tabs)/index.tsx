// Fixing: Verify profile roles before showing role-specific dashboard actions.
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
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

const ANNOUNCEMENT_PREVIEW_LIMIT = 3;

export default function Index() {
  const { user } = useAuth();
  const { width } = useWindowDimensions();

  const [role, setRole] = useState<UserRole | null>(null);
  const [loadingRole, setLoadingRole] = useState(true);
  const [roleError, setRoleError] = useState('');

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
  const [announcementError, setAnnouncementError] = useState('');
  const [readingId, setReadingId] = useState<string | null>(null);
  const [selectedAnnouncement, setSelectedAnnouncement] =
    useState<Announcement | null>(null);
  const [announcementModalVisible, setAnnouncementModalVisible] =
    useState(false);
  const [showAllAnnouncements, setShowAllAnnouncements] = useState(false);

  const [events, setEvents] = useState<CloudEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [eventError, setEventError] = useState('');

  const isSmallScreen = width < 380;

  // Fixing: Do not assume a missing or unreadable profile is a student.
  const loadDashboard = useCallback(async () => {
    setLoadingRole(true);
    setLoadingAnnouncements(true);
    setLoadingEvents(true);

    setRole(null);
    setRoleError('');
    setAnnouncementError('');
    setEventError('');

    if (!user) {
      setRoleError('Please sign in to view your dashboard.');
      setAnnouncements([]);
      setEvents([]);
      setLoadingRole(false);
      setLoadingAnnouncements(false);
      setLoadingEvents(false);
      return;
    }

    try {
      const profile = await getProfile(user.id);

      if (!profile) {
        setRole(null);
        setRoleError(
          'Your account profile could not be verified. Please sign in again or contact your administrator.',
        );
        setAnnouncements([]);
        setEvents([]);
        return;
      }

      const profileRole: UserRole = profile.role;
      setRole(profileRole);

      const [announcementResult, eventResult] = await Promise.all([
        getAnnouncements(user.id, profileRole),
        getAvailableEvents(),
      ]);

      // Fixing: Sort announcements from newest to oldest.
      const sortedAnnouncements = [
        ...(announcementResult.data ?? []),
      ].sort((a, b) => {
        const dateA = a.published_at
          ? new Date(a.published_at).getTime()
          : 0;

        const dateB = b.published_at
          ? new Date(b.published_at).getTime()
          : 0;

        return dateB - dateA;
      });

      setAnnouncements(sortedAnnouncements);

      if (announcementResult.error) {
        setAnnouncementError(
          'Unable to load announcements. Please try again.',
        );
      }

      // Fixing: Sort events by start time, newest first.
      // Invalid or missing dates are placed at the bottom.
      const sortedEvents = [...(eventResult.events ?? [])].sort(
        (a, b) => {
          const dateA = a.start_time
            ? new Date(a.start_time).getTime()
            : Number.NEGATIVE_INFINITY;

          const dateB = b.start_time
            ? new Date(b.start_time).getTime()
            : Number.NEGATIVE_INFINITY;

          const validDateA = Number.isNaN(dateA)
            ? Number.NEGATIVE_INFINITY
            : dateA;

          const validDateB = Number.isNaN(dateB)
            ? Number.NEGATIVE_INFINITY
            : dateB;

          return validDateB - validDateA;
        },
      );

      setEvents(sortedEvents);

      if (eventResult.error) {
        setEventError(
          'Unable to load school events. Please try again.',
        );
      }
    } catch (error) {
      console.error('Failed to load dashboard:', error);

      setRole(null);
      setRoleError(
        'Unable to verify your account. Please refresh or sign in again.',
      );
      setAnnouncements([]);
      setEvents([]);
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
      let active = true;

      // Fixing: Avoid updating dashboard state after this screen loses focus.
      const runLoad = async () => {
        if (!active) return;
        await loadDashboard();
      };

      void runLoad();

      return () => {
        active = false;
      };
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

  // Fixing: Route verified users to the appropriate event workspace.
  const openEvents = () => {
    if (loadingRole || !role) {
      Alert.alert(
        'Account not verified',
        'Please wait until your account role has been verified.',
      );
      return;
    }

    if (role === 'admin') {
      router.push('/administrator');
      return;
    }

    router.push('/(tabs)/teacher');
  };

  const openAnnouncement = async (
    announcement: Announcement,
  ) => {
    setSelectedAnnouncement(announcement);
    setAnnouncementModalVisible(true);

    if (!user || announcement.is_read || readingId) {
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
          'You can still read the announcement. Its read status could not be saved.',
        );
        return;
      }

      const updatedAnnouncement = {
        ...announcement,
        is_read: true,
      };

      setAnnouncements((current) =>
        current.map((item) =>
          item.id === announcement.id
            ? updatedAnnouncement
            : item,
        ),
      );

      setSelectedAnnouncement(updatedAnnouncement);
    } catch (error) {
      console.error('Failed to mark announcement as read:', error);
    } finally {
      setReadingId(null);
    }
  };

  const nextEvent = events[0];

  const unreadCount = announcements.filter(
    (announcement) => !announcement.is_read,
  ).length;

  const visibleAnnouncements = showAllAnnouncements
    ? announcements
    : announcements.slice(0, ANNOUNCEMENT_PREVIEW_LIMIT);

  const quickActionTitle = isAdministrator
    ? 'Admin Control Center'
    : isTeacher
      ? 'Event QR Management'
      : 'Scan Event QR Code';

  const quickActionDescription = isAdministrator
    ? 'Manage users, school events, attendance, and reports from your admin dashboard.'
    : isTeacher
      ? 'Manage your event QR codes.'
      : 'Record attendance at school activities.';

  const quickActionButtonTitle = isAdministrator
    ? 'Open Admin Dashboard'
    : isTeacher
      ? 'Manage Events'
      : 'Scan QR Code';

  const quickActionIcon = isAdministrator
    ? 'shield-checkmark-outline'
    : isTeacher
      ? 'calendar-outline'
      : 'qr-code-outline';

  // Fixing: Do not navigate from quick actions before role verification.
  const handleQuickAction = () => {
    if (loadingRole || !role) {
      Alert.alert(
        'Account not verified',
        'Your account role could not be verified. Please try again.',
      );
      return;
    }

    if (role === 'admin') {
      router.push('/administrator');
    } else if (role === 'teacher') {
      router.push('/(tabs)/teacher');
    } else {
      router.push('/scan');
    }
  };

  // Fixing: Do not render role-specific shortcuts for an unverified account.
  if (!loadingRole && !role) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.verificationContainer}>
          <Ionicons
            name="shield-checkmark-outline"
            size={42}
            color={COLORS.primary}
          />

          <Text style={styles.verificationTitle}>
            Dashboard unavailable
          </Text>

          <Text style={styles.verificationMessage}>
            {roleError ||
              'Your account role could not be verified.'}
          </Text>

          <View style={styles.verificationButton}>
            <AppButton
              theme="primary"
              title="Try Again"
              icon="refresh-outline"
              onPress={refreshDashboard}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
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

        {/* ROLE-BASED QUICK ACTION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Action</Text>

          <View style={styles.scanCard}>
            <View style={styles.scanIconContainer}>
              <Ionicons
                name={quickActionIcon}
                size={28}
                color={COLORS.textPrimary}
              />
            </View>

            <View style={styles.scanTextContainer}>
              <Text style={styles.scanTitle}>
                {quickActionTitle}
              </Text>

              <Text style={styles.scanDescription}>
                {quickActionDescription}
              </Text>
            </View>
          </View>

          <AppButton
            theme="primary"
            title={quickActionButtonTitle}
            icon={quickActionIcon}
            onPress={handleQuickAction}
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
                  onPress={() => router.push('/(tabs)/teacher')}
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
                  onPress={openEvents}
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

        {/* SCHOOL EVENTS SUMMARY */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>School Events</Text>

          {loadingEvents ? (
            <View style={styles.stateCard}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.stateText}>
                Loading school events...
              </Text>
            </View>
          ) : eventError ? (
            <View style={styles.stateCard}>
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
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open school events"
              onPress={openEvents}
              style={({ pressed }) => [
                styles.eventSummaryCard,
                pressed && styles.cardPressed,
              ]}
            >
              <View style={styles.summaryIcon}>
                <Ionicons
                  name="calendar-outline"
                  size={26}
                  color={COLORS.primary}
                />
              </View>

              <View style={styles.summaryContent}>
                <View style={styles.summaryTitleRow}>
                  <Text style={styles.summaryTitle}>
                    {events.length === 0
                      ? 'No available events'
                      : `${events.length} available event${events.length === 1 ? '' : 's'}`}
                  </Text>

                  <Ionicons
                    name="chevron-forward"
                    size={19}
                    color={COLORS.primary}
                  />
                </View>

                {nextEvent ? (
                  <>
                    <Text style={styles.summaryDescription}>
                      {isAdministrator
                        ? 'Open your school event dashboard.'
                        : isTeacher
                          ? 'View and manage your school events.'
                          : 'Tap to explore available school events.'}
                    </Text>

                    <View style={styles.nextEventBadge}>
                      <Ionicons
                        name="time-outline"
                        size={14}
                        color={COLORS.textSecondary}
                      />

                      <Text style={styles.nextEventText}>
                        Latest scheduled event: {nextEvent.title}
                      </Text>
                    </View>

                    <Text style={styles.eventDateText}>
                      {formatEventDate(nextEvent.start_time)}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.summaryDescription}>
                    Tap here to check school events when they become
                    available.
                  </Text>
                )}
              </View>
            </Pressable>
          )}
        </View>

        {/* ANNOUNCEMENTS */}
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
                  {unreadCount} unread
                </Text>
              </View>
            )}
          </View>

          {loadingAnnouncements ? (
            <View style={styles.stateCard}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.stateText}>
                Loading announcements...
              </Text>
            </View>
          ) : announcementError ? (
            <View style={styles.stateCard}>
              <Ionicons
                name="alert-circle-outline"
                size={25}
                color={COLORS.danger}
              />
              <Text style={styles.stateText}>{announcementError}</Text>

              <Pressable
                style={styles.retryButton}
                onPress={refreshDashboard}
              >
                <Text style={styles.retryButtonText}>Try again</Text>
              </Pressable>
            </View>
          ) : announcements.length === 0 ? (
            <View style={styles.stateCard}>
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
                will appear here when published.
              </Text>
            </View>
          ) : (
            <>
              {visibleAnnouncements.map((announcement) => (
                <Pressable
                  key={announcement.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Read announcement: ${announcement.title}`}
                  style={({ pressed }) => [
                    styles.announcementCard,
                    !announcement.is_read &&
                      styles.unreadAnnouncementCard,
                    pressed && styles.cardPressed,
                  ]}
                  onPress={() => void openAnnouncement(announcement)}
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
                      numberOfLines={2}
                      ellipsizeMode="tail"
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

                    <Text style={styles.tapToRead}>
                      Tap to read full announcement
                    </Text>
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
              ))}

              {announcements.length > ANNOUNCEMENT_PREVIEW_LIMIT && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    showAllAnnouncements
                      ? 'Show fewer announcements'
                      : 'View all announcements'
                  }
                  onPress={() =>
                    setShowAllAnnouncements((current) => !current)
                  }
                  style={({ pressed }) => [
                    styles.viewAllAnnouncementsButton,
                    pressed && styles.cardPressed,
                  ]}
                >
                  <Text style={styles.viewAllAnnouncementsText}>
                    {showAllAnnouncements
                      ? 'Show Less'
                      : `View All Announcements (${announcements.length})`}
                  </Text>

                  <Ionicons
                    name={
                      showAllAnnouncements
                        ? 'chevron-up'
                        : 'chevron-down'
                    }
                    size={16}
                    color={COLORS.primary}
                  />
                </Pressable>
              )}
            </>
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

      {/* FULL ANNOUNCEMENT MODAL */}
      <Modal
        visible={announcementModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setAnnouncementModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIcon}>
                <Ionicons
                  name="megaphone-outline"
                  size={23}
                  color={COLORS.primary}
                />
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close announcement"
                onPress={() => setAnnouncementModalVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons
                  name="close"
                  size={23}
                  color={COLORS.textPrimary}
                />
              </Pressable>
            </View>

            {selectedAnnouncement && (
              <>
                <Text style={styles.modalEyebrow}>ANNOUNCEMENT</Text>

                <Text style={styles.modalTitle}>
                  {selectedAnnouncement.title}
                </Text>

                <View style={styles.modalMetadata}>
                  <Ionicons
                    name="calendar-outline"
                    size={15}
                    color={COLORS.primary}
                  />

                  <Text style={styles.modalDate}>
                    Published{' '}
                    {formatAnnouncementDate(
                      selectedAnnouncement.published_at,
                    )}
                  </Text>
                </View>

                <View style={styles.modalMetadata}>
                  <Ionicons
                    name="people-outline"
                    size={15}
                    color={COLORS.primary}
                  />

                  <Text style={styles.modalDate}>
                    Audience:{' '}
                    {selectedAnnouncement.target_audience === 'all'
                      ? 'Everyone'
                      : selectedAnnouncement.target_audience === 'student'
                        ? 'Students'
                        : 'Teachers'}
                  </Text>
                </View>

                <View style={styles.modalDivider} />

                <ScrollView
                  style={styles.modalMessageScroll}
                  contentContainerStyle={styles.modalMessageContent}
                  showsVerticalScrollIndicator
                >
                  <Text style={styles.modalMessage}>
                    {selectedAnnouncement.message}
                  </Text>
                </ScrollView>

                <AppButton
                  theme="primary"
                  title="Close"
                  icon="checkmark-outline"
                  onPress={() => setAnnouncementModalVisible(false)}
                />
              </>
            )}
          </View>
        </View>
      </Modal>
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
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.shortcutIcon}>
        <Ionicons name={icon} size={21} color={COLORS.primary} />
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
  verificationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  verificationTitle: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 14,
  },
  verificationMessage: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 8,
  },
  verificationButton: {
    marginTop: 18,
    width: '100%',
    maxWidth: 220,
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
  cardPressed: {
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
  eventSummaryCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 15,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.surface,
    borderRadius: 16,
  },
  summaryIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryContent: {
    flex: 1,
  },
  summaryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  summaryTitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    flex: 1,
  },
  summaryDescription: {
    color: COLORS.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 5,
  },
  nextEventBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
  },
  nextEventText: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  eventDateText: {
    color: COLORS.textSecondary,
    fontSize: 10,
    marginTop: 5,
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
    minWidth: 0,
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
  tapToRead: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 8,
  },
  viewAllAnnouncementsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.surface,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 2,
  },
  viewAllAnnouncementsText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  stateCard: {
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
    backgroundColor: COLORS.background,
    borderRadius: 22,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  modalIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalEyebrow: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 7,
  },
  modalTitle: {
    color: COLORS.textPrimary,
    fontSize: 21,
    fontWeight: '800',
    lineHeight: 28,
  },
  modalMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 9,
  },
  modalDate: {
    color: COLORS.textSecondary,
    fontSize: 11,
    flexShrink: 1,
  },
  modalDivider: {
    height: 1,
    backgroundColor: COLORS.surface,
    marginTop: 16,
    marginBottom: 12,
  },
  modalMessageScroll: {
    flexGrow: 0,
    flexShrink: 1,
    marginBottom: 18,
  },
  modalMessageContent: {
    paddingBottom: 4,
  },
  modalMessage: {
    color: COLORS.textPrimary,
    fontSize: 14,
    lineHeight: 23,
  },
});