
import { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Alert,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import AppButton from '@/components/AppButton';
import { COLORS } from '@/constants/colors';
import { useAuth, signOut } from '@/lib/auth';
import {
  getProfile,
  updateProfile,
  type Profile,
} from '@/lib/profiles';
import {
  createTeacherRequest,
  getMyTeacherRequest,
  type TeacherRequest,
} from '@/lib/teacherRequests';

export default function ProfileScreen() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [fetchingProfile, setFetchingProfile] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [draftName, setDraftName] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [teacherRequest, setTeacherRequest] =
    useState<TeacherRequest | null>(null);
  const [schoolStaffId, setSchoolStaffId] = useState('');
  const [requestReason, setRequestReason] = useState('');
  const [requestLoading, setRequestLoading] = useState(false);

  // SIGN OUT
  // Navigation is handled by app/_layout.tsx after the session clears.
  const handleSignOut = async () => {
    if (loading) return;

    setLoading(true);

    try {
      const result = await signOut();

      if (result.error) {
        Alert.alert('Sign Out Failed', result.error.message);
      }

      // Do not call router.replace('/login') here.
      // The root layout redirects when session becomes null.
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to sign out. Please try again.';

      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  // LOAD PROFILE
  const loadProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setTeacherRequest(null);
      setFetchingProfile(false);
      return;
    }

    setFetchingProfile(true);

    try {
      const currentProfile = await getProfile(user.id);

      setProfile(currentProfile);
      setDraftName(currentProfile?.full_name ?? '');

      if (currentProfile?.role === 'student') {
        const request = await getMyTeacherRequest(user.id);
        setTeacherRequest(request);
      } else {
        setTeacherRequest(null);
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to load profile.';

      Alert.alert('Error', message);
    } finally {
      setFetchingProfile(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile])
  );

  // SAVE NAME
  const handleSaveName = async () => {
    if (!user || saving) return;

    const newName = draftName.trim();

    if (!newName) {
      Alert.alert('Invalid Name', 'Please enter your full name.');
      return;
    }

    setSaving(true);

    try {
      const { error } = await updateProfile(user.id, {
        full_name: newName,
      });

      if (error) {
        Alert.alert('Error', error);
        return;
      }

      setProfile((previous) =>
        previous
          ? { ...previous, full_name: newName }
          : previous
      );

      setDraftName(newName);
      setEditing(false);

      Alert.alert('Saved', 'Your name has been updated.');
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to update your name.';

      Alert.alert('Error', message);
    } finally {
      setSaving(false);
    }
  };

  // REQUEST TEACHER VERIFICATION
  const handleTeacherRequest = async () => {
    if (!user || requestLoading) return;

    if (!profile) {
      Alert.alert('Error', 'Your profile could not be loaded.');
      return;
    }

    if (profile.role !== 'student') {
      Alert.alert(
        'Not Available',
        'Teacher verification is only available for Student accounts.'
      );
      return;
    }

    const staffId = schoolStaffId.trim();
    const reason = requestReason.trim();

    if (!staffId) {
      Alert.alert(
        'Missing Staff ID',
        'Please enter your School Staff ID.'
      );
      return;
    }

    if (!reason) {
      Alert.alert(
        'Missing Reason',
        'Please explain why you are requesting Teacher access.'
      );
      return;
    }

    setRequestLoading(true);

    try {
      const { data, error } = await createTeacherRequest(
        user.id,
        profile.full_name || user.email || 'Unnamed User',
        staffId,
        reason
      );

      if (error) {
        Alert.alert('Request Failed', error);
        return;
      }

      setTeacherRequest(data);
      setSchoolStaffId('');
      setRequestReason('');

      Alert.alert(
        'Request Submitted',
        'Your Teacher Verification request has been sent to an administrator for review.'
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to submit Teacher Verification request.';

      Alert.alert('Error', message);
    } finally {
      setRequestLoading(false);
    }
  };

  if (fetchingProfile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  const roleLabel =
    profile?.role === 'admin'
      ? 'Administrator'
      : profile?.role === 'teacher'
        ? 'Teacher'
        : 'Student';

  const initial = (
    profile?.full_name?.trim()?.charAt(0) ||
    user?.email?.charAt(0) ||
    'U'
  ).toUpperCase();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* PROFILE HEADER */}
      <View style={styles.profileHeader}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.eyebrow}>YOUR ACCOUNT</Text>
            <Text style={styles.pageTitle}>My Profile</Text>
          </View>

          <View style={styles.headerDecoration}>
            <Ionicons
              name="person-outline"
              size={22}
              color={COLORS.primary}
            />
          </View>
        </View>

        <View style={styles.identityContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
            <View style={styles.avatarCheck}>
              <Ionicons
                name="checkmark"
                size={12}
                color="#FFFFFF"
              />
            </View>
          </View>

          <View style={styles.identityText}>
            <Text style={styles.profileName} numberOfLines={2}>
              {profile?.full_name || 'Welcome!'}
            </Text>

            <Text style={styles.profileEmail} numberOfLines={2}>
              {user?.email || 'No email available'}
            </Text>

            <View
              style={[
                styles.roleBadge,
                profile?.role === 'teacher' && styles.teacherBadge,
                (profile?.role === 'admin') &&
                  styles.adminBadge,
              ]}
            >
              <Ionicons
                name={
                  profile?.role === 'admin'
                    ? 'shield-checkmark-outline'
                    : profile?.role === 'teacher'
                      ? 'school-outline'
                      : 'person-outline'
                }
                size={13}
                color={
                  profile?.role === 'student'
                    ? COLORS.primary
                    : '#FFFFFF'
                }
              />

              <Text
                style={[
                  styles.roleBadgeText,
                  profile?.role !== 'student' &&
                    styles.specialRoleText,
                ]}
              >
                {roleLabel}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.headerBottomLine} />
        <Text style={styles.headerFooter}>
          Manage your account and personal information.
        </Text>
      </View>

      {/* PERSONAL INFORMATION */}
      <View style={styles.sectionHeading}>
        <View style={styles.sectionIcon}>
          <Ionicons
            name="person-circle-outline"
            size={20}
            color={COLORS.primary}
          />
        </View>
        <View>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          <Text style={styles.sectionSubtitle}>
            Your account details
          </Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <View style={styles.fieldHeading}>
          <Text style={styles.fieldLabel}>FULL NAME</Text>

          {!editing && (
            <Pressable
              onPress={() => setEditing(true)}
              style={styles.editAction}
            >
              <Ionicons
                name="create-outline"
                size={15}
                color={COLORS.primary}
              />
              <Text style={styles.editActionText}>Edit</Text>
            </Pressable>
          )}
        </View>

        {editing ? (
          <View style={styles.editForm}>
            <TextInput
              value={draftName}
              onChangeText={setDraftName}
              placeholder="Enter your full name"
              placeholderTextColor={COLORS.textSecondary}
              style={styles.nameInput}
              autoCapitalize="words"
              returnKeyType="done"
              editable={!saving}
            />

            <View style={styles.editButtons}>
              <Pressable
                onPress={() => {
                  setDraftName(profile?.full_name ?? '');
                  setEditing(false);
                }}
                style={styles.cancelButton}
                disabled={saving}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={handleSaveName}
                style={[
                  styles.saveButton,
                  saving && styles.disabledButton,
                ]}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons
                    name="checkmark"
                    size={17}
                    color="#FFFFFF"
                  />
                )}
                <Text style={styles.saveButtonText}>
                  {saving ? 'Saving...' : 'Save'}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Text style={styles.fieldValue}>
            {profile?.full_name || 'No name added yet'}
          </Text>
        )}

        <View style={styles.fieldDivider} />

        <Text style={styles.fieldLabel}>EMAIL ADDRESS</Text>
        <View style={styles.detailRow}>
          <View style={styles.detailIcon}>
            <Ionicons
              name="mail-outline"
              size={19}
              color={COLORS.primary}
            />
          </View>
          <Text style={styles.detailValue}>
            {user?.email || 'No email available'}
          </Text>
        </View>

        <View style={styles.fieldDivider} />

        <Text style={styles.fieldLabel}>ACCOUNT ID</Text>
        <View style={styles.detailRow}>
          <View style={styles.detailIcon}>
            <Ionicons
              name="finger-print-outline"
              size={19}
              color={COLORS.primary}
            />
          </View>
          <Text style={styles.userIdValue} selectable>
            {user?.id || 'Unavailable'}
          </Text>
        </View>
      </View>

      {/* TEACHER VERIFICATION */}
      {profile?.role === 'student' && (
        <>
          <View style={styles.sectionHeading}>
            <View style={styles.sectionIcon}>
              <Ionicons
                name="school-outline"
                size={20}
                color={COLORS.primary}
              />
            </View>

            <View>
              <Text style={styles.sectionTitle}>
                Teacher Verification
              </Text>
              <Text style={styles.sectionSubtitle}>
                Request teacher account access
              </Text>
            </View>
          </View>

          <View style={styles.teacherCard}>
            <View style={styles.teacherIntro}>
              <View style={styles.teacherIllustration}>
                <Ionicons
                  name="id-card-outline"
                  size={27}
                  color={COLORS.primary}
                />
              </View>

              <View style={styles.teacherIntroText}>
                <Text style={styles.teacherCardTitle}>
                  Are you a teacher?
                </Text>
                <Text style={styles.teacherDescription}>
                  Submit your school staff details for administrator
                  verification.
                </Text>
              </View>
            </View>

            {teacherRequest ? (
              <View style={styles.requestStatusBox}>
                <View style={styles.statusHeader}>
                  <Text style={styles.fieldLabel}>REQUEST STATUS</Text>

                  <View
                    style={[
                      styles.statusPill,
                      teacherRequest.status === 'pending' &&
                        styles.pendingPill,
                      teacherRequest.status === 'approved' &&
                        styles.approvedPill,
                      teacherRequest.status === 'rejected' &&
                        styles.rejectedPill,
                    ]}
                  >
                    <View
                      style={[
                        styles.statusDot,
                        teacherRequest.status === 'pending' &&
                          styles.pendingDot,
                        teacherRequest.status === 'approved' &&
                          styles.approvedDot,
                        teacherRequest.status === 'rejected' &&
                          styles.rejectedDot,
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusText,
                        teacherRequest.status === 'pending' &&
                          styles.pendingText,
                        teacherRequest.status === 'approved' &&
                          styles.approvedText,
                        teacherRequest.status === 'rejected' &&
                          styles.rejectedText,
                      ]}
                    >
                      {teacherRequest.status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                <Text style={styles.requestMessage}>
                  {teacherRequest.status === 'pending'
                    ? 'Your request is waiting for an administrator to review it.'
                    : teacherRequest.status === 'approved'
                      ? 'Your request has been approved. Refresh your profile to see any updated role.'
                      : 'Your previous Teacher Verification request was rejected.'}
                </Text>

                {teacherRequest.status === 'rejected' && (
                  <Pressable
                    style={styles.resubmitButton}
                    onPress={() => setTeacherRequest(null)}
                  >
                    <Ionicons
                      name="refresh-outline"
                      size={16}
                      color={COLORS.primary}
                    />
                    <Text style={styles.resubmitButtonText}>
                      Submit a New Request
                    </Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <>
                <Text style={styles.inputLabel}>School Staff ID</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="id-card-outline"
                    size={19}
                    color={COLORS.textSecondary}
                  />
                  <TextInput
                    value={schoolStaffId}
                    onChangeText={setSchoolStaffId}
                    placeholder="Enter your School Staff ID"
                    placeholderTextColor={COLORS.textSecondary}
                    style={styles.teacherInput}
                    autoCapitalize="characters"
                    editable={!requestLoading}
                  />
                </View>

                <Text style={styles.inputLabel}>Reason for Request</Text>
                <View style={[styles.inputWrapper, styles.reasonWrapper]}>
                  <Ionicons
                    name="document-text-outline"
                    size={19}
                    color={COLORS.textSecondary}
                    style={styles.reasonIcon}
                  />
                  <TextInput
                    value={requestReason}
                    onChangeText={setRequestReason}
                    placeholder="Explain why you need Teacher access..."
                    placeholderTextColor={COLORS.textSecondary}
                    style={[styles.teacherInput, styles.reasonInput]}
                    multiline
                    textAlignVertical="top"
                    editable={!requestLoading}
                  />
                </View>

                <Pressable
                  onPress={handleTeacherRequest}
                  disabled={requestLoading}
                  style={[
                    styles.teacherRequestButton,
                    requestLoading && styles.disabledButton,
                  ]}
                >
                  {requestLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Ionicons
                      name="paper-plane-outline"
                      size={18}
                      color="#FFFFFF"
                    />
                  )}
                  <Text style={styles.teacherRequestButtonText}>
                    {requestLoading
                      ? 'Submitting Request...'
                      : 'Submit Verification Request'}
                  </Text>
                </Pressable>

                <View style={styles.privacyNote}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={16}
                    color={COLORS.success}
                  />
                  <Text style={styles.privacyText}>
                    Your request will be reviewed by an administrator.
                  </Text>
                </View>
              </>
            )}
          </View>
        </>
      )}

      {/* SIGN OUT */}
      <View style={styles.signOutCard}>
        <View style={styles.signOutInfo}>
          <View style={styles.signOutIcon}>
            <Ionicons
              name="log-out-outline"
              size={22}
              color={COLORS.danger}
            />
          </View>

          <View style={styles.signOutTextContainer}>
            <Text style={styles.signOutTitle}>Sign Out</Text>
            <Text style={styles.signOutSubtitle}>
              Sign out of your account on this device.
            </Text>
          </View>
        </View>

        <View style={styles.signOutButton}>
          <AppButton
            title={loading ? 'Signing Out...' : 'Sign Out'}
            icon="log-out-outline"
            onPress={handleSignOut}
            disabled={loading}
          />
        </View>
      </View>

      <Text style={styles.footerText}>
        School Event Attendance
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 36,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  profileHeader: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 20,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 2,
    marginBottom: 5,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  headerDecoration: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 82,
    height: 82,
    borderRadius: 28,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 34,
    fontWeight: '800',
    color: COLORS.primary,
  },
  avatarCheck: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 25,
    height: 25,
    borderRadius: 13,
    backgroundColor: COLORS.success,
    borderWidth: 2,
    borderColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityText: {
    flex: 1,
    marginLeft: 16,
  },
  profileName: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 5,
  },
  profileEmail: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 10,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
  },
  teacherBadge: {
    backgroundColor: COLORS.primary,
  },
  adminBadge: {
    backgroundColor: '#4b14aa',
  },
  specialRoleText: {
    color: '#FFFFFF',
  },
  headerBottomLine: {
    height: 1,
    backgroundColor: COLORS.border,
    marginTop: 22,
    marginBottom: 12,
  },
  headerFooter: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 13,
  },
  sectionIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 3,
  },
  infoCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 18,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  fieldHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 1.1,
  },
  fieldValue: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  editAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 9,
    backgroundColor: COLORS.surface,
  },
  editActionText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  editForm: {
    marginTop: 2,
  },
  nameInput: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    paddingHorizontal: 12,
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  editButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
    gap: 8,
  },
  cancelButton: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  fieldDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 18,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  detailIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 11,
  },
  detailValue: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  userIdValue: {
    flex: 1,
    fontSize: 11,
    lineHeight: 17,
    color: COLORS.textSecondary,
  },
  teacherCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 18,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  teacherIntro: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  teacherIllustration: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teacherIntroText: {
    flex: 1,
    marginLeft: 12,
  },
  teacherCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 5,
  },
  teacherDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textSecondary,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSecondary,
    marginBottom: 8,
    marginTop: 12,
    letterSpacing: 0.5,
  },
  inputWrapper: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    paddingHorizontal: 12,
  },
  teacherInput: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: COLORS.textPrimary,
    fontSize: 13,
  },
  reasonWrapper: {
    alignItems: 'flex-start',
    paddingTop: 12,
  },
  reasonIcon: {
    marginTop: 8,
  },
  reasonInput: {
    minHeight: 95,
    paddingTop: 6,
  },
  teacherRequestButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: COLORS.primary,
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 18,
  },
  teacherRequestButtonText: {
    flex: 1,
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 14,
  },
  privacyText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    color: COLORS.textSecondary,
  },
  requestStatusBox: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 14,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  pendingPill: {
    backgroundColor: '#FFF1D6',
  },
  approvedPill: {
    backgroundColor: '#E4F3E7',
  },
  rejectedPill: {
    backgroundColor: '#FBE9E7',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  pendingDot: {
    backgroundColor: '#B7791F',
  },
  approvedDot: {
    backgroundColor: '#2E7D32',
  },
  rejectedDot: {
    backgroundColor: '#C62828',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  pendingText: {
    color: '#8A5A12',
  },
  approvedText: {
    color: '#2E7D32',
  },
  rejectedText: {
    color: '#C62828',
  },
  requestMessage: {
    fontSize: 12,
    lineHeight: 19,
    color: COLORS.textSecondary,
    marginTop: 12,
  },
  resubmitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 14,
    paddingVertical: 9,
    paddingHorizontal: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
  },
  resubmitButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  signOutCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginTop: 2,
  },
  signOutInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  signOutIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FBE9E7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  signOutTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  signOutSubtitle: {
    fontSize: 11,
    lineHeight: 16,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  signOutButton: {
    marginTop: 15,
  },
  disabledButton: {
    opacity: 0.6,
  },
  footerText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 22,
  },
});
