// Fixing: Preserve the premium mocha-and-cream registration UI,
// slightly reduce the banner size, and animate its entrance.
// Existing student signup, validation, and navigation are preserved.

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS } from '@/constants/colors';
import { signUp } from '@/lib/auth';

export default function RegisterScreen() {
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] =
    useState(false);
  const [loading, setLoading] = useState(false);

  // Fixing: Fade and slide the registration banner into view.
  const bannerOpacity = useRef(new Animated.Value(0)).current;
  const bannerTranslateY = useRef(new Animated.Value(-12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(bannerOpacity, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.timing(bannerTranslateY, {
        toValue: 0,
        duration: 450,
        useNativeDriver: true,
      }),
    ]).start();
  }, [bannerOpacity, bannerTranslateY]);

  const handleRegister = async () => {
    if (loading) return;

    const name = fullName.trim();
    const emailValue = email.trim();

    if (!name) {
      Alert.alert('Missing Name', 'Please enter your full name.');
      return;
    }

    if (!emailValue) {
      Alert.alert('Missing Email', 'Please enter your email.');
      return;
    }

    if (!password) {
      Alert.alert('Missing Password', 'Please enter a password.');
      return;
    }

    if (!confirmPassword) {
      Alert.alert(
        'Missing Password Confirmation',
        'Please re-enter your password.',
      );
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(
        'Passwords Do Not Match',
        'Please make sure both password fields are the same.',
      );
      return;
    }

    Keyboard.dismiss();
    setLoading(true);

    try {
      const { data, error } = await signUp(
        emailValue,
        password,
        {
          full_name: name,
          role: 'student',
        },
      );

      if (error) {
        Alert.alert('Registration Failed', error.message);
        return;
      }

      if (data?.session) {
        // The root layout handles navigation after authentication.
        return;
      }

      Alert.alert(
        'Account Created',
        'Your account was created. Please check your email if confirmation is required.',
        [
          {
            text: 'OK',
            onPress: () => {
              router.navigate('/login');
            },
          },
        ],
      );
    } catch (error: unknown) {
      Alert.alert(
        'Registration Failed',
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Fixing: Smaller animated registration banner. */}
          <Animated.View
            style={[
              styles.hero,
              {
                opacity: bannerOpacity,
                transform: [{ translateY: bannerTranslateY }],
              },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to login"
              disabled={loading}
              onPress={() => router.navigate('/login')}
              style={styles.backButton}
            >
              <Ionicons
                name="arrow-back"
                size={21}
                color={COLORS.textOnPrimary}
              />
            </Pressable>

            <View style={styles.brandRow}>
              <View style={styles.brandIcon}>
                <Ionicons
                  name="qr-code-outline"
                  size={27}
                  color={COLORS.textOnPrimary}
                />
              </View>

              <View>
                <Text style={styles.brandName}>QR-ATT</Text>
                <Text style={styles.brandCaption}>
                  ATTENDANCE MANAGEMENT
                </Text>
              </View>
            </View>

            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>GET STARTED</Text>
              <Text style={styles.heroTitle}>
                Your campus{'\n'}journey starts here.
              </Text>
              <Text style={styles.heroDescription}>
                Create your student account to get connected with
                your school's attendance system.
              </Text>
            </View>

            <View style={styles.decorativeCircleLarge} />
            <View style={styles.decorativeCircleSmall} />

            <View style={styles.heroBottom}>
              <Ionicons
                name="person-circle-outline"
                size={16}
                color={COLORS.textOnPrimary}
              />
              <Text style={styles.heroBottomText}>
                Simple. Secure. Student-focused.
              </Text>
            </View>
          </Animated.View>

          {/* Existing registration card design preserved. */}
          <View style={styles.formCard}>
            <View style={styles.cardHeading}>
              <Text style={styles.cardTitle}>Create account</Text>
              <Text style={styles.cardSubtitle}>
                Fill in your details to get started.
              </Text>
            </View>

            <View style={styles.accountNotice}>
              <View style={styles.noticeIcon}>
                <Ionicons
                  name="school-outline"
                  size={21}
                  color={COLORS.primary}
                />
              </View>
              <View style={styles.noticeCopy}>
                <Text style={styles.noticeTitle}>Student account</Text>
                <Text style={styles.noticeText}>
                  New registrations are created as student accounts.
                  Teachers must request verification separately.
                </Text>
              </View>
            </View>

            <Text style={styles.label}>Full name</Text>
            <View style={styles.inputShell}>
              <Ionicons
                name="person-outline"
                size={20}
                color={COLORS.textSecondary}
              />
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Enter your full name"
                placeholderTextColor={COLORS.textSecondary}
                autoCapitalize="words"
                autoCorrect={false}
                autoComplete="name"
                editable={!loading}
                returnKeyType="next"
                accessibilityLabel="Full name"
              />
            </View>

            <Text style={styles.label}>Email address</Text>
            <View style={styles.inputShell}>
              <Ionicons
                name="mail-outline"
                size={20}
                color={COLORS.textSecondary}
              />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                editable={!loading}
                returnKeyType="next"
                accessibilityLabel="Email address"
              />
            </View>

            <Text style={styles.label}>Password</Text>
            <View style={styles.inputShell}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color={COLORS.textSecondary}
              />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Create a password"
                placeholderTextColor={COLORS.textSecondary}
                secureTextEntry={!passwordVisible}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                editable={!loading}
                returnKeyType="next"
                accessibilityLabel="Password"
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  passwordVisible ? 'Hide password' : 'Show password'
                }
                disabled={loading}
                hitSlop={10}
                onPress={() => setPasswordVisible((visible) => !visible)}
                style={styles.visibilityButton}
              >
                <Ionicons
                  name={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
                  size={21}
                  color={COLORS.textSecondary}
                />
              </Pressable>
            </View>

            <Text style={styles.label}>Confirm password</Text>
            <View style={styles.inputShell}>
              <Ionicons
                name="shield-checkmark-outline"
                size={20}
                color={COLORS.textSecondary}
              />
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Re-enter your password"
                placeholderTextColor={COLORS.textSecondary}
                secureTextEntry={!confirmPasswordVisible}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                editable={!loading}
                returnKeyType="done"
                onSubmitEditing={() => void handleRegister()}
                accessibilityLabel="Confirm password"
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  confirmPasswordVisible
                    ? 'Hide confirmation password'
                    : 'Show confirmation password'
                }
                disabled={loading}
                hitSlop={10}
                onPress={() =>
                  setConfirmPasswordVisible((visible) => !visible)
                }
                style={styles.visibilityButton}
              >
                <Ionicons
                  name={
                    confirmPasswordVisible
                      ? 'eye-off-outline'
                      : 'eye-outline'
                  }
                  size={21}
                  color={COLORS.textSecondary}
                />
              </Pressable>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => void handleRegister()}
              disabled={loading}
              style={({ pressed }) => [
                styles.createButton,
                pressed && !loading && styles.buttonPressed,
                loading && styles.buttonDisabled,
              ]}
            >
              {loading ? (
                <>
                  <ActivityIndicator color={COLORS.textOnPrimary} />
                  <Text style={styles.createButtonText}>
                    Creating account...
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.createButtonText}>
                    Create Account
                  </Text>
                  <Ionicons
                    name="arrow-forward"
                    size={20}
                    color={COLORS.textOnPrimary}
                  />
                </>
              )}
            </Pressable>

            <View style={styles.loginRow}>
              <Text style={styles.loginPrompt}>
                Already have an account?
              </Text>
              <Pressable
                accessibilityRole="button"
                disabled={loading}
                onPress={() => router.navigate('/login')}
                hitSlop={8}
              >
                <Text style={styles.loginLink}>Sign in</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.footer}>
            <Ionicons
              name="shield-checkmark-outline"
              size={16}
              color={COLORS.textSecondary}
            />
            <Text style={styles.footerText}>
              Your account starts with student access.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },

  // Fixing: Reduce banner height and padding, preserving its design.
  hero: {
    minHeight: 260,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: COLORS.textPrimary,
    borderRadius: 26,
    padding: 20,
    marginBottom: 20,
    justifyContent: 'space-between',
  },
  backButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    zIndex: 3,
    width: 39,
    height: 39,
    borderRadius: 13,
    backgroundColor: 'rgba(255,253,249,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,253,249,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 1,
    paddingRight: 35,
  },
  brandIcon: {
    width: 45,
    height: 45,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,253,249,0.18)',
  },
  brandName: {
    color: COLORS.textOnPrimary,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  brandCaption: {
    color: COLORS.surface,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginTop: 3,
  },
  heroCopy: {
    marginTop: 20,
    marginBottom: 16,
    zIndex: 1,
  },
  eyebrow: {
    color: COLORS.surface,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 8,
  },
  heroTitle: {
    color: COLORS.textOnPrimary,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  heroDescription: {
    color: '#E9DED4',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
    maxWidth: 290,
  },
  decorativeCircleLarge: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 28,
    borderColor: 'rgba(232,213,196,0.08)',
    right: -76,
    top: 55,
  },
  decorativeCircleSmall: {
    position: 'absolute',
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: 'rgba(139,111,90,0.22)',
    right: 12,
    top: 112,
  },
  heroBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    zIndex: 1,
  },
  heroBottomText: {
    color: COLORS.surface,
    fontSize: 11,
    fontWeight: '600',
  },
  formCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.09,
    shadowRadius: 18,
    elevation: 4,
  },
  cardHeading: {
    marginBottom: 20,
  },
  cardTitle: {
    color: COLORS.textPrimary,
    fontSize: 25,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  cardSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  accountNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    padding: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    marginBottom: 21,
  },
  noticeIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeCopy: {
    flex: 1,
  },
  noticeTitle: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 4,
  },
  noticeText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    lineHeight: 17,
  },
  label: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
    marginTop: 16,
  },
  inputShell: {
    minHeight: 53,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    backgroundColor: COLORS.background,
  },
  input: {
    flex: 1,
    minWidth: 0,
    color: COLORS.textPrimary,
    fontSize: 13,
    paddingVertical: 13,
  },
  visibilityButton: {
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButton: {
    minHeight: 55,
    marginTop: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 15,
    paddingHorizontal: 18,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 7,
    elevation: 3,
  },
  createButtonText: {
    color: COLORS.textOnPrimary,
    fontSize: 14,
    fontWeight: '900',
  },
  buttonPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.99 }],
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  loginRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    marginTop: 23,
  },
  loginPrompt: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  loginLink: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 7,
    paddingTop: 22,
  },
  footerText: {
    color: COLORS.textSecondary,
    fontSize: 11,
  },
});