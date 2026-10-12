
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { COLORS } from '@/constants/colors';
import {
  getAnnouncements,
  markAnnouncementAsRead,
  type Announcement,
} from '@/lib/announcements';
import type { Role } from '@/lib/profiles';
import { useAuth } from '@/lib/auth';

type Props = {
  role: Extract<Role, 'admin' | 'teacher'>;
};

export default function EventAnnouncementsSection({ role }: Props) {
  const router = useRouter();
  const { user } = useAuth();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const loadAnnouncements = useCallback(async () => {
    if (!user) {
      setAnnouncements([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await getAnnouncements(user.id, role);

      if (result.error) {
        setError(result.error);
        setAnnouncements([]);
      } else {
        setAnnouncements(result.data ?? []);
      }
    } catch (err) {
      console.error('Failed to load announcements:', err);
      setError('Unable to load announcements. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user, role]);

  useFocusEffect(
    useCallback(() => {
      void loadAnnouncements();
    }, [loadAnnouncements]),
  );

  const handleMarkRead = async (announcement: Announcement) => {
    if (!user || announcement.is_read || markingId) return;

    setMarkingId(announcement.id);
    setError(null);

    try {
      const result = await markAnnouncementAsRead(
        announcement.id,
        user.id,
      );

      if (result.error) {
        setError(result.error);
        return;
      }

      setAnnouncements((current) =>
        current.map((item) =>
          item.id === announcement.id
            ? { ...item, is_read: true }
            : item,
        ),
      );
    } catch (err) {
      console.error('Failed to mark announcement as read:', err);
      setError('Unable to update read status. Please try again.');
    } finally {
      setMarkingId(null);
    }
  };

  const unreadCount = announcements.filter(
    (announcement) => !announcement.is_read,
  ).length;

  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <View style={styles.headingIcon}>
          <Ionicons
            name="megaphone-outline"
            size={22}
            color={COLORS.primary}
          />
        </View>

        <View style={styles.headingText}>
          <Text style={styles.title}>Event Announcements</Text>
          <Text style={styles.subtitle}>
            School updates and important notices.
          </Text>
        </View>

        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount}</Text>
          </View>
        )}
      </View>

      {loading ? (
        <View style={styles.status}>
          <ActivityIndicator color={COLORS.primary} />
          <Text style={styles.statusText}>Loading announcements...</Text>
        </View>
      ) : error ? (
        <View style={styles.status}>
          <Ionicons
            name="alert-circle-outline"
            size={20}
            color={COLORS.danger}
          />
          <Text style={styles.errorText}>{error}</Text>

          <Pressable onPress={() => void loadAnnouncements()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : announcements.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons
            name="mail-open-outline"
            size={30}
            color={COLORS.textSecondary}
          />
          <Text style={styles.emptyTitle}>No announcements yet</Text>
          <Text style={styles.emptyText}>
            Published announcements for your account will appear here.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {announcements.map((announcement) => (
            <View
              key={announcement.id}
              style={[
                styles.announcement,
                !announcement.is_read && styles.unreadAnnouncement,
              ]}
            >
              <View style={styles.announcementTop}>
                <Text style={styles.announcementTitle}>
                  {announcement.title}
                </Text>

                {!announcement.is_read && (
                  <View style={styles.unreadDot} />
                )}
              </View>

              <Text style={styles.audience}>
                Audience: {announcement.target_audience}
              </Text>

              <Text style={styles.message}>
                {announcement.message}
              </Text>

              <View style={styles.announcementFooter}>
                <Text style={styles.readStatus}>
                  {announcement.is_read ? 'Read' : 'Unread'}
                </Text>

                {!announcement.is_read && (
                  <Pressable
                    disabled={markingId !== null}
                    onPress={() => void handleMarkRead(announcement)}
                    style={({ pressed }) => [
                      styles.readButton,
                      pressed && styles.pressed,
                      markingId !== null && styles.disabled,
                    ]}
                  >
                    {markingId === announcement.id ? (
                      <ActivityIndicator
                        size="small"
                        color={COLORS.primary}
                      />
                    ) : (
                      <>
                        <Ionicons
                          name="checkmark-circle-outline"
                          size={16}
                          color={COLORS.primary}
                        />
                        <Text style={styles.readButtonText}>
                          Mark as read
                        </Text>
                      </>
                    )}
                  </Pressable>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      <Pressable
        onPress={() => router.push('/administrator/announcements')}
        style={({ pressed }) => [
          styles.manageButton,
          pressed && styles.pressed,
        ]}
      >
        <Ionicons
          name="settings-outline"
          size={18}
          color={COLORS.primary}
        />
        <Text style={styles.manageButtonText}>
          {role === 'admin'
            ? 'Manage Announcements'
            : 'Create Announcement'}
        </Text>
        <Ionicons
          name="chevron-forward"
          size={18}
          color={COLORS.primary}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    gap: 10,
  },
  headingIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headingText: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 3,
  },
  badge: {
    minWidth: 25,
    height: 25,
    paddingHorizontal: 7,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  status: {
    minHeight: 85,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    gap: 8,
  },
  statusText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  errorText: {
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.danger,
    textAlign: 'center',
  },
  retryText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primary,
    padding: 5,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 10,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 9,
  },
  emptyText: {
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 5,
  },
  list: {
    gap: 10,
  },
  announcement: {
    padding: 13,
    borderRadius: 13,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  unreadAnnouncement: {
    borderColor: COLORS.primary,
  },
  announcementTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  announcementTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginTop: 5,
  },
  audience: {
    fontSize: 10,
    color: COLORS.textSecondary,
    textTransform: 'capitalize',
    marginTop: 5,
  },
  message: {
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.textPrimary,
    marginTop: 9,
  },
  announcementFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  readStatus: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  readButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 7,
  },
  readButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingVertical: 13,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    marginTop: 14,
  },
  manageButtonText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primary,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.5,
  },
});
