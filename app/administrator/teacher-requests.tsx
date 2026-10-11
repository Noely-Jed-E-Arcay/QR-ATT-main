import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { COLORS } from '@/constants/colors';

import {
  approveTeacherRequest,
  getPendingTeacherRequests,
  rejectTeacherRequest,
  type TeacherRequest,
} from '@/lib/teacherRequests';

export default function TeacherRequestsScreen() {
  const [requests, setRequests] = useState<TeacherRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] =
    useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    const { data, error } =
      await getPendingTeacherRequests();

    if (error) {
      Alert.alert(
        'Error',
        error
      );
      return;
    }

    setRequests(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);

      loadRequests().finally(() => {
        setLoading(false);
      });
    }, [loadRequests])
  );

  const handleRefresh = async () => {
    setRefreshing(true);

    await loadRequests();

    setRefreshing(false);
  };

  const handleApprove = (request: TeacherRequest) => {
    Alert.alert(
      'Approve Teacher',
      `Approve ${request.full_name} as a Teacher?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Approve',
          onPress: async () => {
            setProcessingId(request.id);

            const { error } =
              await approveTeacherRequest(
                request.id
              );

            setProcessingId(null);

            if (error) {
              Alert.alert(
                'Approval Failed',
                error
              );
              return;
            }

            Alert.alert(
              'Approved',
              `${request.full_name} is now a Teacher.`
            );

            await loadRequests();
          },
        },
      ]
    );
  };

  const handleReject = (request: TeacherRequest) => {
    Alert.alert(
      'Reject Teacher Request',
      `Reject ${request.full_name}'s Teacher request?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setProcessingId(request.id);

            const { error } =
              await rejectTeacherRequest(
                request.id
              );

            setProcessingId(null);

            if (error) {
              Alert.alert(
                'Rejection Failed',
                error
              );
              return;
            }

            Alert.alert(
              'Rejected',
              'Teacher request rejected.'
            );

            await loadRequests();
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>
          Loading teacher requests...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      }
    >
      <Text style={styles.title}>
        Teacher Verification
      </Text>

      <Text style={styles.subtitle}>
        Review users requesting Teacher access.
      </Text>

      {requests.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>
            No Pending Requests
          </Text>

          <Text style={styles.emptyText}>
            There are currently no Teacher verification
            requests waiting for review.
          </Text>
        </View>
      ) : (
        requests.map((request) => {
          const processing =
            processingId === request.id;

          return (
            <View
              key={request.id}
              style={styles.card}
            >
              <Text style={styles.name}>
                {request.full_name}
              </Text>

              <Text style={styles.label}>
                School Staff ID
              </Text>

              <Text style={styles.value}>
                {request.school_staff_id ||
                  'Not provided'}
              </Text>

              <Text style={styles.label}>
                Reason
              </Text>

              <Text style={styles.value}>
                {request.reason ||
                  'No reason provided'}
              </Text>

              <Text style={styles.label}>
                Requested
              </Text>

              <Text style={styles.value}>
                {new Date(
                  request.created_at
                ).toLocaleString()}
              </Text>

              <View style={styles.buttonRow}>
                <Pressable
                  style={[
                    styles.rejectButton,
                    processing &&
                      styles.disabledButton,
                  ]}
                  onPress={() =>
                    handleReject(request)
                  }
                  disabled={processing}
                >
                  <Text style={styles.rejectText}>
                    Reject
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.approveButton,
                    processing &&
                      styles.disabledButton,
                  ]}
                  onPress={() =>
                    handleApprove(request)
                  }
                  disabled={processing}
                >
                  <Text style={styles.approveText}>
                    {processing
                      ? 'Processing...'
                      : 'Approve'}
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  content: {
    padding: 20,
    paddingBottom: 40,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },

  loadingText: {
    marginTop: 10,
    color: COLORS.textSecondary,
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginTop: 6,
    marginBottom: 20,
  },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  name: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 14,
  },

  label: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginTop: 8,
    marginBottom: 3,
    textTransform: 'uppercase',
  },

  value: {
    fontSize: 15,
    color: COLORS.textPrimary,
    lineHeight: 21,
  },

  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },

  rejectButton: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },

  rejectText: {
    color: COLORS.danger,
    fontSize: 15,
    fontWeight: '700',
  },

  approveButton: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
  },

  approveText: {
    color: COLORS.textOnPrimary,
    fontSize: 15,
    fontWeight: '700',
  },

  disabledButton: {
    opacity: 0.5,
  },

  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },

  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});