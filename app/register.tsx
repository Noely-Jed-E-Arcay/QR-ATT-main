import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { COLORS } from '@/constants/colors';
import { signUp } from '@/lib/auth';

export default function RegisterScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    const name = fullName.trim();
    const emailValue = email.trim();

    if (!name) {
      Alert.alert(
        'Missing Name',
        'Please enter your full name.'
      );
      return;
    }

    if (!emailValue) {
      Alert.alert(
        'Missing Email',
        'Please enter your email.'
      );
      return;
    }

    if (!password) {
      Alert.alert(
        'Missing Password',
        'Please enter a password.'
      );
      return;
    }

    if (!confirmPassword) {
      Alert.alert(
        'Missing Password Confirmation',
        'Please re-enter your password.'
      );
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(
        'Passwords Do Not Match',
        'Please make sure both password fields are the same.'
      );
      return;
    }

    setLoading(true);

    const { data, error } = await signUp(
      emailValue,
      password,
      {
        full_name: name,
        role: 'student',
      }
    );

    setLoading(false);

    if (error) {
      Alert.alert(
        'Registration Failed',
        error.message
      );
      return;
    }

    if (data.session) {
      router.replace('/(tabs)');
      return;
    }

    Alert.alert(
      'Account Created',
      'Your account was created. Please check your email if confirmation is required.',
      [
        {
          text: 'OK',
          onPress: () => router.replace('/login'),
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Create Account
      </Text>

      <Text style={styles.subtitle}>
        Create your QR-ATT account.
      </Text>

      <Text style={styles.label}>
        Full Name
      </Text>

      <TextInput
        style={styles.input}
        value={fullName}
        onChangeText={setFullName}
        placeholder="Enter your full name"
        autoCapitalize="words"
      />

      <Text style={styles.label}>
        Email
      </Text>

      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="Enter your email"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Text style={styles.label}>
        Password
      </Text>

      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder="Enter your password"
        secureTextEntry
      />

      <Text style={styles.label}>
        Re-enter Password
      </Text>

      <TextInput
        style={styles.input}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder="Re-enter your password"
        secureTextEntry
      />

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>
          Account Type
        </Text>

        <Text style={styles.infoText}>
          New accounts are registered as Students.
          {'\n\n'}
          If you are a Teacher, you must request
          Teacher Verification after creating your account.
        </Text>
      </View>

      <Pressable
        style={[
          styles.button,
          loading && styles.buttonDisabled,
        ]}
        onPress={handleRegister}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading
            ? 'Creating Account...'
            : 'Create Account'}
        </Text>
      </Pressable>

      <Pressable
        style={styles.loginButton}
        onPress={() => router.replace('/login')}
      >
        <Text style={styles.loginText}>
          Already have an account? Log in
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },

  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
    color: COLORS.textPrimary,
  },

  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 28,
  },

  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },

  input: {
    height: 50,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
    fontSize: 16,
    backgroundColor: COLORS.card,
  },

  infoBox: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.primary,
    marginBottom: 20,
  },

  infoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 6,
  },

  infoText: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textPrimary,
  },

  button: {
    height: 52,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: COLORS.primary,
    borderWidth: 1,
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  buttonText: {
    color: COLORS.textOnPrimary,
    fontSize: 16,
    fontWeight: '700',
  },

  loginButton: {
    alignItems: 'center',
    marginTop: 20,
  },

  loginText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
});