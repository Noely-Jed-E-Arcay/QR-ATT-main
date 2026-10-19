// Fixing: Keep the premium mocha-and-cream login UI,
// make the welcome banner slightly smaller, and animate its entrance
// while preserving Supabase authentication and Expo Router navigation.

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { signIn } from '@/lib/auth';

export default function LoginScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Fixing: Smooth banner entrance animation.
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

  const handleLogin = async () => {
    if (loading) return;

    const cleanEmail = email.trim();

    if (!cleanEmail || !password) {
      setError('Please enter both your email and password.');
      return;
    }

    Keyboard.dismiss();
    setError(null);
    setLoading(true);

    try {
      const { data, error: authError } = await signIn(
        cleanEmail,
        password,
      );

      if (authError) {
        setError(authError.message);
        return;
      }

      if (!data?.user || !data?.session) {
        setError(
          'Login did not return a valid session. Please try again.',
        );
        return;
      }

      // Keep the existing successful-login destination.
      router.replace('/(tabs)');
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred during login.',
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
          {/* Fixing: Smaller animated premium welcome banner. */}
          <Animated.View
            style={[
              styles.hero,
              {
                opacity: bannerOpacity,
                transform: [{ translateY: bannerTranslateY }],
              },
            ]}
          >
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
              <Text style={styles.eyebrow}>WELCOME BACK</Text>
              <Text style={styles.heroTitle}>
                Your campus,{'\n'}one scan away.
              </Text>
              <Text style={styles.heroDescription}>
                Sign in to manage your attendance and stay connected
                with your school activities.
              </Text>
            </View>

            <View style={styles.decorativeCircleLarge} />
            <View style={styles.decorativeCircleSmall} />

            <View style={styles.heroBottom}>
              <Ionicons
                name="shield-checkmark-outline"
                size={15}
                color={COLORS.textOnPrimary}
              />
              <Text style={styles.heroBottomText}>
                Secure access to your account
              </Text>
            </View>
          </Animated.View>

          {/* Existing login card design preserved. */}
          <View style={styles.formCard}>
            <View style={styles.cardHeading}>
              <Text style={styles.cardTitle}>Sign in</Text>
              <Text style={styles.cardSubtitle}>
                Enter your account details to continue.
              </Text>
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons
                  name="alert-circle-outline"
                  size={20}
                  color={COLORS.danger}
                />
                <Text style={styles.errorText}>{error}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss error"
                  hitSlop={8}
                  onPress={() => setError(null)}
                >
                  <Ionicons
                    name="close"
                    size={18}
                    color={COLORS.danger}
                  />
                </Pressable>
              </View>
            ) : null}

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
                onChangeText={(value) => {
                  setEmail(value);
                  if (error) setError(null);
                }}
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

            <View style={styles.passwordLabelRow}>
              <Text style={styles.label}>Password</Text>
            </View>

            <View style={styles.inputShell}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color={COLORS.textSecondary}
              />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  if (error) setError(null);
                }}
                placeholder="Enter your password"
                placeholderTextColor={COLORS.textSecondary}
                secureTextEntry={!passwordVisible}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="current-password"
                editable={!loading}
                returnKeyType="done"
                onSubmitEditing={() => void handleLogin()}
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

            <Pressable
              accessibilityRole="button"
              disabled={loading}
              onPress={() => void handleLogin()}
              style={({ pressed }) => [
                styles.signInButton,
                pressed && !loading && styles.buttonPressed,
                loading && styles.buttonDisabled,
              ]}
            >
              {loading ? (
                <>
                  <ActivityIndicator color={COLORS.textOnPrimary} />
                  <Text style={styles.signInButtonText}>
                    Signing in...
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.signInButtonText}>Sign In</Text>
                  <Ionicons
                    name="arrow-forward"
                    size={20}
                    color={COLORS.textOnPrimary}
                  />
                </>
              )}
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>NEW TO QR-ATT?</Text>
              <View style={styles.divider} />
            </View>

            <Pressable
              accessibilityRole="button"
              disabled={loading}
              onPress={() => router.push('/register')}
              style={({ pressed }) => [
                styles.createAccountButton,
                pressed && styles.outlinePressed,
              ]}
            >
              <Ionicons
                name="person-add-outline"
                size={19}
                color={COLORS.primary}
              />
              <Text style={styles.createAccountText}>
                Create an account
              </Text>
            </Pressable>
          </View>

          <View style={styles.footer}>
            <Ionicons
              name="school-outline"
              size={16}
              color={COLORS.textSecondary}
            />
            <Text style={styles.footerText}>
              Made for a more connected campus.
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

  // Fixing: Reduce banner height and padding without changing its design.
  hero: {
    minHeight: 250,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: COLORS.textPrimary,
    borderRadius: 26,
    padding: 20,
    marginBottom: 20,
    justifyContent: 'space-between',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 1,
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
    marginTop: 18,
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
    fontSize: 29,
    lineHeight: 34,
    fontWeight: '900',
    letterSpacing: -0.8,
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
    top: 45,
  },
  decorativeCircleSmall: {
    position: 'absolute',
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: 'rgba(139,111,90,0.22)',
    right: 12,
    top: 100,
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

  // Login card and remaining styles stay the same.
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
    marginBottom: 23,
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
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8B9B5',
    backgroundColor: '#FFF0EF',
    marginBottom: 18,
  },
  errorText: {
    flex: 1,
    color: COLORS.danger,
    fontSize: 12,
    lineHeight: 18,
  },
  label: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
  },
  passwordLabelRow: {
    marginTop: 18,
  },
  inputShell: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    backgroundColor: COLORS.background,
  },
  input: {
    flex: 1,
    minWidth: 0,
    color: COLORS.textPrimary,
    fontSize: 14,
    paddingVertical: 14,
  },
  visibilityButton: {
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInButton: {
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
  signInButtonText: {
    color: COLORS.textOnPrimary,
    fontSize: 15,
    fontWeight: '900',
  },
  buttonPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.99 }],
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 25,
    marginBottom: 17,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    color: COLORS.textSecondary,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  createAccountButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  createAccountText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  outlinePressed: {
    opacity: 0.75,
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