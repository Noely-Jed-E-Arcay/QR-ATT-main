import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { COLORS } from '@/constants/colors';
import {
  getAdminUsers,
  updateAdminUser,
  type AdminUser,
} from '@/lib/admin';
import { useAuth } from '@/lib/auth';
import type { Role } from '@/lib/profiles';

const roles: Role[] = ['student', 'teacher', 'admin'];

export default function ManageUsersScreen() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | Role>('all');
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('student');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const result = await getAdminUsers();

    if (result.error) {
      setError(result.error);
    } else {
      setUsers(result.data);
    }

    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const filtered = users.filter((item) => {
    const query = search.trim().toLowerCase();
    const matchesSearch =
      !query ||
      item.email.toLowerCase().includes(query) ||
      (item.full_name ?? '').toLowerCase().includes(query) ||
      item.id.toLowerCase().includes(query);

    const matchesRole = roleFilter === 'all' || item.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const openEditor = (item: AdminUser) => {
    if (item.id === user?.id) {
      Alert.alert(
        'Protected account',
        'You cannot modify your own administrator account from user management.'
      );
      return;
    }

    setSelected(item);
    setName(item.full_name ?? '');
    setRole(item.role);
  };

  const save = async () => {
    if (!selected) return;

    if (!name.trim()) {
      Alert.alert('Missing name', 'Please enter a name.');
      return;
    }

    setSaving(true);
    const result = await updateAdminUser(selected.id, {
      full_name: name.trim(),
      role,
    });
    setSaving(false);

    if (result.error) {
      Alert.alert('Could not save user', result.error);
      return;
    }

    setSelected(null);
    await load();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.muted}>Loading users...</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }
      >
        <Text style={styles.title}>Manage Users</Text>
        <Text style={styles.subtitle}>
          Search accounts and update basic profile information or roles.
        </Text>

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={20} color={COLORS.textSecondary} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search name, email, or ID"
            placeholderTextColor={COLORS.textSecondary}
            style={styles.searchInput}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>
          <Filter label="All" active={roleFilter === 'all'} onPress={() => setRoleFilter('all')} />
          <Filter label="Students" active={roleFilter === 'student'} onPress={() => setRoleFilter('student')} />
          <Filter label="Teachers" active={roleFilter === 'teacher'} onPress={() => setRoleFilter('teacher')} />
          <Filter label="Administrators" active={roleFilter === 'admin'} onPress={() => setRoleFilter('admin')} />
        </ScrollView>

        {error && <Text style={styles.error}>{error}</Text>}

        <Text style={styles.count}>{filtered.length} user(s)</Text>

        {filtered.map((item) => (
          <Pressable
            key={item.id}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            onPress={() => openEditor(item)}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(item.full_name || item.email).charAt(0).toUpperCase()}
              </Text>
            </View>

            <View style={styles.cardBody}>
              <Text style={styles.name}>{item.full_name || 'No name set'}</Text>
              <Text style={styles.email}>{item.email}</Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleText}>{formatRole(item.role)}</Text>
              </View>
            </View>

            <Ionicons name="create-outline" size={20} color={COLORS.textSecondary} />
          </Pressable>
        ))}

        {!filtered.length && <Text style={styles.muted}>No users match your search.</Text>}
      </ScrollView>

      <Modal
        visible={Boolean(selected)}
        animationType="slide"
        transparent
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit User</Text>
              <Pressable onPress={() => setSelected(null)}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </Pressable>
            </View>

            <Text style={styles.label}>Full Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              style={styles.input}
              placeholder="Full name"
              placeholderTextColor={COLORS.textSecondary}
            />

            <Text style={styles.label}>Role</Text>
            <View style={styles.roleRow}>
              {roles.map((item) => (
                <Pressable
                  key={item}
                  onPress={() => setRole(item)}
                  style={[styles.roleOption, role === item && styles.roleOptionActive]}
                >
                  <Text style={[styles.roleOptionText, role === item && styles.roleOptionTextActive]}>
                    {formatRole(item)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.protectionNote}>
              Account creation, deletion, and Supabase Auth password management are not exposed here because this Expo client uses the Supabase anonymous key. Role/profile changes are restricted to administrators by database policies.
            </Text>

            <Pressable
              disabled={saving}
              onPress={save}
              style={[styles.saveButton, saving && styles.disabled]}
            >
              {saving ? (
                <ActivityIndicator color={COLORS.textOnPrimary} />
              ) : (
                <Text style={styles.saveButtonText}>Save Changes</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

function Filter({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.filter, active && styles.filterActive]}>
      <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
    </Pressable>
  );
}

function formatRole(role: Role) {
  if (role === 'admin') return 'Administrator';
  return role.charAt(0).toUpperCase() + role.slice(1);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20, paddingBottom: 40 },
  center: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muted: { color: COLORS.textSecondary, marginTop: 8 },
  title: { color: COLORS.textPrimary, fontSize: 24, fontWeight: '800' },
  subtitle: { color: COLORS.textSecondary, lineHeight: 20, marginTop: 5, marginBottom: 15 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, color: COLORS.textPrimary, paddingVertical: 12, marginLeft: 8 },
  filters: { marginVertical: 12 },
  filter: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: COLORS.card,
  },
  filterActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  filterTextActive: { color: COLORS.textOnPrimary },
  error: { color: COLORS.danger, marginBottom: 10 },
  count: { color: COLORS.textSecondary, fontSize: 12, marginBottom: 8 },
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 9,
  },
  pressed: { opacity: 0.75 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  avatarText: { color: COLORS.textPrimary, fontWeight: '800' },
  cardBody: { flex: 1 },
  name: { color: COLORS.textPrimary, fontWeight: '700', fontSize: 14 },
  email: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.surface,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 6,
  },
  roleText: { color: COLORS.textPrimary, fontSize: 11, fontWeight: '700' },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  modalCard: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
    paddingBottom: 30,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '800' },
  label: { color: COLORS.textPrimary, fontWeight: '700', fontSize: 13, marginTop: 18, marginBottom: 7 },
  input: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: COLORS.textPrimary,
  },
  roleRow: { flexDirection: 'row', gap: 7, flexWrap: 'wrap' },
  roleOption: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 9,
    backgroundColor: COLORS.card,
  },
  roleOptionActive: { borderColor: COLORS.primary, backgroundColor: COLORS.surface },
  roleOptionText: { color: COLORS.textSecondary, fontSize: 12 },
  roleOptionTextActive: { color: COLORS.textPrimary, fontWeight: '700' },
  protectionNote: {
    color: COLORS.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 14,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 13,
    marginTop: 18,
  },
  saveButtonText: { color: COLORS.textOnPrimary, fontWeight: '800' },
  disabled: { opacity: 0.6 },
});
