import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { getProfile } from '@/lib/profiles';
import {
  createAnnouncement,
  deleteAnnouncement,
  getAllAnnouncements,
  updateAnnouncement,
  type Announcement,
  type AnnouncementAudience,
} from '@/lib/announcements';

type UserRole = 'admin' | 'teacher' | 'student';

const AUDIENCES: {
  label: string;
  value: AnnouncementAudience;
}[] = [
  { label: 'Everyone', value: 'all' },
  { label: 'Students', value: 'student' },
  { label: 'Teachers', value: 'teacher' },
];

export default function AnnouncementsScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [role, setRole] = useState<UserRole>('student');
  const [checkingRole, setCheckingRole] = useState(true);
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [audience, setAudience] =
    useState<AnnouncementAudience>('all');
  const [published, setPublished] = useState(true);
  const [error, setError] = useState('');

  const isAdmin = role === 'admin';

  const loadAnnouncements = useCallback(async () => {
    if (!user) {
      setRole('student');
      setCheckingRole(false);
      setLoading(false);
      setItems([]);
      setError('Please sign in to access announcements.');
      return;
    }

    setCheckingRole(true);
    setLoading(true);
    setError('');

    try {
      const profile = await getProfile(user.id);

      const currentRole: UserRole =
        profile?.role === 'admin'
          ? 'admin'
          : profile?.role === 'teacher'
            ? 'teacher'
            : 'student';

      setRole(currentRole);

      if (currentRole !== 'admin') {
        setItems([]);
        setError(
          'Only administrators can access announcement management.',
        );
        return;
      }

      const result = await getAllAnnouncements();

      if (result.error) {
        setItems([]);
        setError(result.error);
      } else {
        setItems(result.data ?? []);
      }
    } catch (err) {
      console.error('Failed to load announcements:', err);
      setItems([]);
      setError('Unable to load announcements. Please try again.');
    } finally {
      setCheckingRole(false);
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void loadAnnouncements();
    }, [loadAnnouncements]),
  );

  function openCreateForm() {
    if (!isAdmin) {
      Alert.alert(
        'Administrator only',
        'Only administrators can create announcements.',
      );
      return;
    }

    setEditing(null);
    setTitle('');
    setMessage('');
    setAudience('all');
    setPublished(true);
    setError('');
    setModalVisible(true);
  }

  function openEditForm(item: Announcement) {
    if (!isAdmin) {
      Alert.alert(
        'Administrator only',
        'Only administrators can edit announcements.',
      );
      return;
    }

    setEditing(item);
    setTitle(item.title);
    setMessage(item.message);
    setAudience(item.target_audience);
    setPublished(item.is_published);
    setError('');
    setModalVisible(true);
  }

  async function handleSave() {
    if (!user) {
      Alert.alert('Session required', 'Please sign in again.');
      return;
    }

    if (!isAdmin) {
      setError('Only administrators can manage announcements.');
      return;
    }

    const cleanTitle = title.trim();
    const cleanMessage = message.trim();

    if (!cleanTitle || !cleanMessage) {
      setError('Enter both a title and a message.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const result = editing
        ? await updateAnnouncement(editing.id, {
            title: cleanTitle,
            message: cleanMessage,
            target_audience: audience,
            is_published: published,
          })
        : await createAnnouncement(
            {
              title: cleanTitle,
              message: cleanMessage,
              target_audience: audience,
              is_published: published,
            },
            user.id,
          );

      if (result.error) {
        setError(result.error);
        return;
      }

      setModalVisible(false);
      await loadAnnouncements();

      Alert.alert(
        'Success',
        editing
          ? 'Announcement updated.'
          : published
            ? 'Announcement published.'
            : 'Announcement saved as a draft.',
      );
    } catch (err) {
      console.error('Failed to save announcement:', err);
      setError(
        'Could not save the announcement. Check your permissions and try again.',
      );
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(item: Announcement) {
    if (!isAdmin) {
      Alert.alert(
        'Administrator only',
        'Only administrators can delete announcements.',
      );
      return;
    }

    Alert.alert(
      'Delete announcement?',
      `“${item.title}” will be permanently deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await deleteAnnouncement(item.id);

              if (result.error) {
                Alert.alert('Delete failed', result.error);
                return;
              }

              await loadAnnouncements();
              Alert.alert('Deleted', 'Announcement deleted.');
            } catch (err) {
              console.error('Failed to delete announcement:', err);
              Alert.alert(
                'Delete failed',
                'Unable to delete this announcement.',
              );
            }
          },
        },
      ],
    );
  }

  function audienceLabel(value: AnnouncementAudience) {
    return (
      AUDIENCES.find((option) => option.value === value)?.label ??
      'Everyone'
    );
  }

  if (checkingRole) {
    return (
      <SafeAreaView
        style={styles.container}
        edges={['top', 'left', 'right']}
      >
        <View style={styles.loadingScreen}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.stateText}>
            Checking your permissions...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView
        style={styles.container}
        edges={['top', 'left', 'right']}
      >
        <View style={styles.loadingScreen}>
          <Ionicons
            name="lock-closed-outline"
            size={40}
            color={COLORS.danger}
          />

          <Text style={styles.emptyTitle}>
            Administrator access only
          </Text>

          <Text style={styles.stateText}>
            Teachers and students can view published announcements
            from the Home screen. Only administrators can create,
            publish, edit, or delete announcements.
          </Text>

          <Pressable
            style={styles.retryButton}
            onPress={() => router.back()}
          >
            <Text style={styles.retryText}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.container}
      edges={['top', 'left', 'right']}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons
            name="arrow-back"
            size={22}
            color={COLORS.textPrimary}
          />
        </Pressable>

        <View style={styles.headerText}>
          <Text style={styles.heading}>Announcements</Text>
          <Text style={styles.subheading}>
            Manage school announcements
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.introCard}>
          <View style={styles.introIcon}>
            <Ionicons
              name="megaphone-outline"
              size={25}
              color={COLORS.primary}
            />
          </View>

          <View style={styles.introText}>
            <Text style={styles.introTitle}>
              School announcements
            </Text>
            <Text style={styles.introDescription}>
              Create, publish, edit, and delete school notices for
              students, teachers, or everyone.
            </Text>
            <Text style={styles.roleText}>
              Signed in as Administrator
            </Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={openCreateForm}
          style={({ pressed }) => [
            styles.createButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name="add-circle-outline"
            size={21}
            color="#FFFFFF"
          />
          <Text style={styles.createButtonText}>
            Create announcement
          </Text>
        </Pressable>

        <View style={styles.listHeading}>
          <Text style={styles.listTitle}>All announcements</Text>

          <Pressable
            accessibilityRole="button"
            onPress={() => void loadAnnouncements()}
            style={styles.refreshButton}
          >
            <Ionicons
              name="refresh-outline"
              size={18}
              color={COLORS.primary}
            />
            <Text style={styles.refreshText}>Refresh</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator
              size="large"
              color={COLORS.primary}
            />
            <Text style={styles.stateText}>
              Loading announcements...
            </Text>
          </View>
        ) : error && items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons
              name="alert-circle-outline"
              size={28}
              color={COLORS.danger}
            />
            <Text style={styles.emptyTitle}>
              Could not load announcements
            </Text>
            <Text style={styles.stateText}>{error}</Text>

            <Pressable
              onPress={() => void loadAnnouncements()}
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons
              name="notifications-off-outline"
              size={30}
              color={COLORS.primary}
            />
            <Text style={styles.emptyTitle}>
              No announcements yet
            </Text>
            <Text style={styles.stateText}>
              Create your first announcement using the button above.
            </Text>
          </View>
        ) : (
          items.map((item) => (
            <View key={item.id} style={styles.announcementCard}>
              <View style={styles.cardTop}>
                <View style={styles.cardIcon}>
                  <Ionicons
                    name="megaphone-outline"
                    size={20}
                    color={COLORS.primary}
                  />
                </View>

                <View style={styles.cardHeading}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardDate}>
                    {formatDate(item.created_at)}
                  </Text>
                </View>

                <View
                  style={[
                    styles.statusBadge,
                    item.is_published
                      ? styles.publishedBadge
                      : styles.draftBadge,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      item.is_published
                        ? styles.publishedText
                        : styles.draftText,
                    ]}
                  >
                    {item.is_published ? 'PUBLISHED' : 'DRAFT'}
                  </Text>
                </View>
              </View>

              <Text style={styles.cardMessage}>{item.message}</Text>

              <View style={styles.audienceRow}>
                <Ionicons
                  name="people-outline"
                  size={15}
                  color={COLORS.textSecondary}
                />
                <Text style={styles.audienceText}>
                  Audience: {audienceLabel(item.target_audience)}
                </Text>
              </View>

              <View style={styles.cardActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => openEditForm(item)}
                  style={styles.editButton}
                >
                  <Ionicons
                    name="create-outline"
                    size={17}
                    color={COLORS.primary}
                  />
                  <Text style={styles.editButtonText}>Edit</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => confirmDelete(item)}
                  style={styles.deleteButton}
                >
                  <Ionicons
                    name="trash-outline"
                    size={17}
                    color={COLORS.danger}
                  />
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}

        <Text style={styles.footerNote}>
          Only administrators can manage announcements. Published
          announcements are visible to users according to the selected
          audience. Drafts are not shown to regular users.
        </Text>
      </ScrollView>

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          if (!saving) setModalVisible(false);
        }}
      >
        <SafeAreaView
          style={styles.modalContainer}
          edges={['top', 'left', 'right', 'bottom']}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editing ? 'Edit announcement' : 'New announcement'}
            </Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close form"
              disabled={saving}
              onPress={() => setModalVisible(false)}
              style={styles.closeButton}
            >
              <Ionicons
                name="close"
                size={24}
                color={COLORS.textPrimary}
              />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.formContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.fieldLabel}>Title</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Enter announcement title"
              placeholderTextColor={COLORS.textSecondary}
              maxLength={120}
              style={styles.input}
              editable={!saving}
            />

            <Text style={styles.fieldLabel}>Message</Text>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Write your announcement here..."
              placeholderTextColor={COLORS.textSecondary}
              multiline
              textAlignVertical="top"
              maxLength={5000}
              style={[styles.input, styles.messageInput]}
              editable={!saving}
            />

            <Text style={styles.fieldLabel}>Who should see this?</Text>

            <View style={styles.audienceOptions}>
              {AUDIENCES.map((option) => {
                const selected = audience === option.value;

                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setAudience(option.value)}
                    style={[
                      styles.audienceOption,
                      selected && styles.audienceOptionSelected,
                    ]}
                  >
                    <Ionicons
                      name={
                        selected
                          ? 'radio-button-on'
                          : 'radio-button-off'
                      }
                      size={18}
                      color={
                        selected
                          ? COLORS.primary
                          : COLORS.textSecondary
                      }
                    />
                    <Text
                      style={[
                        styles.audienceOptionText,
                        selected && styles.audienceOptionTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.publishRow}>
              <View style={styles.publishCopy}>
                <Text style={styles.publishTitle}>Publish now</Text>
                <Text style={styles.publishDescription}>
                  Turn off to save this announcement as a draft.
                </Text>
              </View>

              <Switch
                value={published}
                onValueChange={setPublished}
                disabled={saving}
                trackColor={{
                  false: COLORS.border,
                  true: COLORS.primary,
                }}
              />
            </View>

            {error ? (
              <View style={styles.formError}>
                <Ionicons
                  name="alert-circle-outline"
                  size={18}
                  color={COLORS.danger}
                />
                <Text style={styles.formErrorText}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={() => void handleSave()}
              style={[
                styles.saveButton,
                saving && styles.disabledButton,
              ]}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={20}
                    color="#FFFFFF"
                  />
                  <Text style={styles.saveButtonText}>
                    {editing
                      ? 'Save changes'
                      : published
                        ? 'Publish announcement'
                        : 'Save draft'}
                  </Text>
                </>
              )}
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Date unavailable';
  }

  return date.toLocaleString();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  heading: {
    color: COLORS.textPrimary,
    fontSize: 19,
    fontWeight: '800',
  },
  subheading: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 3,
  },
  content: {
    padding: 16,
    paddingBottom: 35,
  },
  introCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  introIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  introText: {
    flex: 1,
  },
  introTitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  introDescription: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },
  roleText: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 7,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 13,
    padding: 14,
    marginBottom: 23,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.8,
  },
  listHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  listTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 6,
  },
  refreshText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  centerState: {
    padding: 28,
    alignItems: 'center',
    gap: 10,
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 10,
  },
  stateText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 5,
  },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 10,
  },
  retryButton: {
    marginTop: 12,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 9,
  },
  retryText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  announcementCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  cardIcon: {
    width: 37,
    height: 37,
    borderRadius: 11,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeading: {
    flex: 1,
  },
  cardTitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  cardDate: {
    color: COLORS.textSecondary,
    fontSize: 10,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 7,
  },
  publishedBadge: {
    backgroundColor: '#E2F3E7',
  },
  draftBadge: {
    backgroundColor: '#F4E8D8',
  },
  statusText: {
    fontSize: 8,
    fontWeight: '900',
  },
  publishedText: {
    color: '#28643D',
  },
  draftText: {
    color: '#80552D',
  },
  cardMessage: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 13,
  },
  audienceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  audienceText: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '600',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 11,
    marginTop: 13,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 9,
    padding: 10,
  },
  editButtonText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    flex: 1,
    backgroundColor: '#FDECEC',
    borderRadius: 9,
    padding: 10,
  },
  deleteButtonText: {
    color: COLORS.danger,
    fontSize: 11,
    fontWeight: '800',
  },
  footerNote: {
    color: COLORS.textSecondary,
    fontSize: 10,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 12,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formContent: {
    padding: 18,
    paddingBottom: 35,
  },
  fieldLabel: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    color: COLORS.textPrimary,
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 13,
  },
  messageInput: {
    minHeight: 140,
  },
  audienceOptions: {
    gap: 8,
  },
  audienceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  audienceOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surface,
  },
  audienceOptionText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  audienceOptionTextSelected: {
    color: COLORS.textPrimary,
    fontWeight: '800',
  },
  publishRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 13,
    marginTop: 20,
  },
  publishCopy: {
    flex: 1,
  },
  publishTitle: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  publishDescription: {
    color: COLORS.textSecondary,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 4,
  },
  formError: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 14,
  },
  formErrorText: {
    flex: 1,
    color: COLORS.danger,
    fontSize: 11,
    lineHeight: 16,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 14,
    marginTop: 20,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.65,
  },
});