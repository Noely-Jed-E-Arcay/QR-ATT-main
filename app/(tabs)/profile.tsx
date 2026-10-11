import { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Alert,
  TextInput,
  Pressable,
  ScrollView,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';

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

  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [fetchingProfile, setFetchingProfile] = useState(true);

  const [profile, setProfile] = useState<Profile | null>(null);

  const [draftName, setDraftName] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Teacher verification
  const [teacherRequest, setTeacherRequest] =
    useState<TeacherRequest | null>(null);

  const [schoolStaffId, setSchoolStaffId] =
    useState('');

  const [requestReason, setRequestReason] =
    useState('');

  const [requestLoading, setRequestLoading] =
    useState(false);

  // ============================================================
  // SIGN OUT
  // ============================================================

  const handleSignOut = async () => {
    setLoading(true);

    try {
      await signOut();
      router.replace('/login');
    } catch (err: any) {
      Alert.alert(
        'Error',
        err?.message || 'Failed to sign out.'
      );
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // LOAD PROFILE
  // ============================================================

  const loadProfile = useCallback(async () => {
    if (!user) {
      setFetchingProfile(false);
      return;
    }

    setFetchingProfile(true);

    try {
      const p = await getProfile(user.id);

      setProfile(p);
      setDraftName(p?.full_name ?? '');

      // --------------------------------------------------------
      // Only students need Teacher Verification information.
      // --------------------------------------------------------

      if (p?.role === 'student') {
        const request = await getMyTeacherRequest(user.id);

        setTeacherRequest(request);
      } else {
        setTeacherRequest(null);
      }
    } catch (error: any) {
      Alert.alert(
        'Error',
        error?.message || 'Failed to load profile.'
      );
    } finally {
      setFetchingProfile(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  // ============================================================
  // SAVE NAME
  // ============================================================

  const handleSaveName = async () => {
    if (!user) return;

    const newName = draftName.trim();

    if (!newName) {
      Alert.alert(
        'Invalid Name',
        'Please enter your full name.'
      );
      return;
    }

    setSaving(true);

    const { error } = await updateProfile(user.id, {
      full_name: newName,
    });

    setSaving(false);

    if (error) {
      Alert.alert('Error', error);
    } else {
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              full_name: newName,
            }
          : prev
      );

      setEditing(false);

      Alert.alert(
        'Saved',
        'Your name has been updated.'
      );
    }
  };

  // ============================================================
  // REQUEST TEACHER VERIFICATION
  // ============================================================

  const handleTeacherRequest = async () => {
    if (!user) return;

    if (!profile) {
      Alert.alert(
        'Error',
        'Your profile could not be loaded.'
      );
      return;
    }

    // Only students can request Teacher verification.
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
      const { data, error } =
        await createTeacherRequest(
          user.id,
          profile.full_name ||
            user.email ||
            'Unnamed User',
          staffId,
          reason
        );

      if (error) {
        Alert.alert(
          'Request Failed',
          error
        );
        return;
      }

      setTeacherRequest(data);

      setSchoolStaffId('');
      setRequestReason('');

      Alert.alert(
        'Request Submitted',
        'Your Teacher Verification request has been sent to an administrator for review.'
      );
    } catch (error: any) {
      Alert.alert(
        'Error',
        error?.message ||
          'Failed to submit Teacher Verification request.'
      );
    } finally {
      setRequestLoading(false);
    }
  };

  // ============================================================
  // LOADING SCREEN
  // ============================================================

  if (fetchingProfile) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>
          Loading profile...
        </Text>
      </View>
    );
  }

  // ============================================================
  // MAIN SCREEN
  // ============================================================

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>My Profile</Text>

      {/* ======================================================
          ROLE BADGE
          ====================================================== */}

      <View
        style={[
          styles.roleBadge,
          profile?.role === 'student' &&
            styles.roleBadgeStudent,
          profile?.role === 'teacher' &&
            styles.roleBadgeTeacher,
          profile?.role === 'admin' &&
            styles.roleBadgeAdmin,
        ]}
      >
        <Text
          style={[
            styles.roleBadgeText,
            profile?.role === 'student' &&
              styles.roleBadgeTextStudent,
            profile?.role === 'teacher' &&
              styles.roleBadgeTextTeacher,
            profile?.role === 'admin' &&
              styles.roleBadgeTextAdmin,
          ]}
        >
          {profile?.role === 'admin'
            ? 'Administrator'
            : profile?.role === 'teacher'
              ? 'Teacher'
              : 'Student'}
        </Text>
      </View>

      {/* ======================================================
          ACCOUNT INFORMATION
          ====================================================== */}

      {user && (
        <View style={styles.infoCard}>
          <Text style={styles.label}>Email</Text>

          <Text style={styles.value}>
            {user.email}
          </Text>

          <Text style={styles.label}>User ID</Text>

          <Text style={styles.valueSmall}>
            {user.id}
          </Text>
        </View>
      )}

      {/* ======================================================
          NAME
          ====================================================== */}

      {editing ? (
        <View style={styles.nameEditRow}>
          <TextInput
            value={draftName}
            onChangeText={setDraftName}
            placeholder="Enter your full name"
            placeholderTextColor={COLORS.textSecondary}
            style={styles.nameInput}
            autoCapitalize="words"
          />

          <Pressable
            onPress={handleSaveName}
            style={[
              styles.saveButton,
              saving && styles.disabledButton,
            ]}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>
              {saving ? 'Saving...' : 'Save'}
            </Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={() => setEditing(true)}
          style={styles.nameRow}
        >
          <Text style={styles.value}>
            {profile?.full_name ||
              'Tap to add your name'}
          </Text>

          <Text style={styles.editHint}>
            Edit
          </Text>
        </Pressable>
      )}

      {/* ======================================================
          TEACHER VERIFICATION
          ONLY SHOWS FOR STUDENTS
          ====================================================== */}

      {profile?.role === 'student' && (
        <View style={styles.teacherVerificationCard}>
          <Text style={styles.teacherVerificationTitle}>
            Teacher Verification
          </Text>

          <Text style={styles.teacherVerificationDescription}>
            If you are a teacher, you can submit a
            verification request. An administrator will
            review your request before your account can
            become a Teacher account.
          </Text>

          {/* --------------------------------------------------
              EXISTING REQUEST
              -------------------------------------------------- */}

          {teacherRequest ? (
            <View style={styles.requestStatusBox}>
              <Text style={styles.requestStatusLabel}>
                Request Status
              </Text>

              <Text
                style={[
                  styles.requestStatus,
                  teacherRequest.status ===
                    'pending' &&
                    styles.statusPending,
                  teacherRequest.status ===
                    'approved' &&
                    styles.statusApproved,
                  teacherRequest.status ===
                    'rejected' &&
                    styles.statusRejected,
                ]}
              >
                {teacherRequest.status.toUpperCase()}
              </Text>

              {teacherRequest.status ===
                'pending' && (
                <Text style={styles.requestMessage}>
                  Your request is currently waiting for
                  an administrator to review it.
                </Text>
              )}

              {teacherRequest.status ===
                'approved' && (
                <Text style={styles.requestMessage}>
                  Your request has been approved. Your
                  account is now eligible for Teacher
                  access. Please refresh your profile.
                </Text>
              )}

              {teacherRequest.status ===
                'rejected' && (
                <Text style={styles.requestMessage}>
                  Your previous Teacher Verification
                  request was rejected.
                </Text>
              )}
            </View>
          ) : (
            <>
              {/* ------------------------------------------------
                  STAFF ID
                  ------------------------------------------------ */}

              <Text style={styles.inputLabel}>
                School Staff ID
              </Text>

              <TextInput
                value={schoolStaffId}
                onChangeText={setSchoolStaffId}
                placeholder="Enter your School Staff ID"
                placeholderTextColor={
                  COLORS.textSecondary
                }
                style={styles.teacherInput}
                autoCapitalize="characters"
              />

              {/* ------------------------------------------------
                  REASON
                  ------------------------------------------------ */}

              <Text style={styles.inputLabel}>
                Reason
              </Text>

              <TextInput
                value={requestReason}
                onChangeText={setRequestReason}
                placeholder="Why are you requesting Teacher access?"
                placeholderTextColor={
                  COLORS.textSecondary
                }
                style={[
                  styles.teacherInput,
                  styles.reasonInput,
                ]}
                multiline
                textAlignVertical="top"
              />

              {/* ------------------------------------------------
                  SUBMIT
                  ------------------------------------------------ */}

              <Pressable
                onPress={handleTeacherRequest}
                disabled={requestLoading}
                style={[
                  styles.teacherRequestButton,
                  requestLoading &&
                    styles.disabledButton,
                ]}
              >
                <Text
                  style={
                    styles.teacherRequestButtonText
                  }
                >
                  {requestLoading
                    ? 'Submitting...'
                    : 'Request Teacher Verification'}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      )}

      {/* ======================================================
          SIGN OUT
          ====================================================== */}

      <View style={styles.signOutContainer}>
        <AppButton
          title="Sign Out"
          icon="log-out-outline"
          onPress={handleSignOut}
          disabled={loading}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  contentContainer: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },

  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    fontSize: 15,
    color: COLORS.textSecondary,
  },

  title: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 16,
  },

  /* ============================================================
     ROLE BADGE
     ============================================================ */

  roleBadge: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },

  roleBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },

  roleBadgeStudent: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.primary,
  },

  roleBadgeTextStudent: {
    color: COLORS.primary,
  },

  roleBadgeTeacher: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.shadow,
  },

  roleBadgeTextTeacher: {
    color: COLORS.textOnPrimary,
  },

  roleBadgeAdmin: {
    backgroundColor: '#4b14aa',
    borderColor: '#b303f8',
  },

  roleBadgeTextAdmin: {
    color: '#fff',
  },

  /* ============================================================
     ACCOUNT INFORMATION
     ============================================================ */

  infoCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
  },

  label: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 4,
    marginTop: 8,
  },

  value: {
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },

  valueSmall: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },

  /* ============================================================
     NAME
     ============================================================ */

  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
  },

  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 24,
  },

  nameInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textPrimary,
  },

  saveButton: {
    marginLeft: 12,
    backgroundColor: COLORS.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 14,
  },

  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },

  editHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },

  /* ============================================================
     TEACHER VERIFICATION
     ============================================================ */

  teacherVerificationCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  teacherVerificationTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },

  teacherVerificationDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textSecondary,
    marginBottom: 18,
  },

  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 6,
    marginTop: 8,
  },

  teacherInput: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.background,
    fontSize: 14,
  },

  reasonInput: {
    minHeight: 100,
    marginBottom: 16,
  },

  teacherRequestButton: {
    minHeight: 50,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },

  teacherRequestButtonText: {
    color: COLORS.textOnPrimary,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },

  /* ============================================================
     REQUEST STATUS
     ============================================================ */

  requestStatusBox: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  requestStatusLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 5,
  },

  requestStatus: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
  },

  statusPending: {
    color: COLORS.warning,
  },

  statusApproved: {
    color: COLORS.success,
  },

  statusRejected: {
    color: COLORS.danger,
  },

  requestMessage: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textSecondary,
  },

  /* ============================================================
     GENERAL
     ============================================================ */

  disabledButton: {
    opacity: 0.6,
  },

  signOutContainer: {
    marginTop: 4,
  },
});