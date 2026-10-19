// Fixing: Verify the account role before exposing role-based tabs.
import { Tabs, useFocusEffect, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { getProfile, type Role } from '@/lib/profiles';

type AnimatedScanIconProps = {
  color: string;
  focused: boolean;
};

function AnimatedScanIcon({
  focused,
}: AnimatedScanIconProps) {
  const floatAnimation = useRef(new Animated.Value(0)).current;
  const pulseAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const float = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnimation, {
          toValue: 1,
          duration: 850,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnimation, {
          toValue: 0,
          duration: 850,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 1,
          duration: 1000,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnimation, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    float.start();
    pulse.start();

    return () => {
      float.stop();
      pulse.stop();
      floatAnimation.stopAnimation();
      pulseAnimation.stopAnimation();
    };
  }, [floatAnimation, pulseAnimation]);

  const translateY = floatAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -4],
  });

  const scale = floatAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.07],
  });

  const ringScale = pulseAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1.45],
  });

  const ringOpacity = pulseAnimation.interpolate({
    inputRange: [0, 0.15, 1],
    outputRange: [0.35, 0.2, 0],
  });

  return (
    <Animated.View
      style={[
        styles.scanButtonWrapper,
        { transform: [{ translateY }, { scale }] },
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.scanPulseRing,
          {
            opacity: ringOpacity,
            transform: [{ scale: ringScale }],
          },
        ]}
      />

      <View
        style={[
          styles.scanIconContainer,
          focused && styles.scanIconContainerFocused,
        ]}
      >
        <Ionicons
          name={focused ? 'qr-code' : 'qr-code-outline'}
          color="#FFFFFF"
          size={25}
        />
      </View>
    </Animated.View>
  );
}

export default function TabLayout() {
  const { user } = useAuth();
  const router = useRouter();

  const [role, setRole] = useState<Role | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      if (!user) {
        setRole(null);
        setRoleLoading(false);

        return () => {
          active = false;
        };
      }

      setRole(null);
      setRoleLoading(true);

      getProfile(user.id)
        .then((profile) => {
          if (active) {
            setRole(profile?.role ?? null);
          }
        })
        .catch((error) => {
          console.error('Unable to load tab role:', error);

          if (active) {
            setRole(null);
          }
        })
        .finally(() => {
          if (active) {
            setRoleLoading(false);
          }
        });

      return () => {
        active = false;
      };
    }, [user]),
  );

  useEffect(() => {
    if (!roleLoading && user && !role) {
      router.replace('/login');
    }
  }, [roleLoading, user, role, router]);

  if (roleLoading || (user && !role)) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const isStudent = role === 'student';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: COLORS.primary,
          tabBarInactiveTintColor: COLORS.textSecondary,
          tabBarShowLabel: true,
          tabBarStyle: {
            position: 'relative',
            height: 65,
            backgroundColor: COLORS.card,
            borderTopWidth: 0,
            borderRadius: 22,
            marginHorizontal: 16,
            marginTop: 4,
            marginBottom: 6,
            paddingTop: 5,
            paddingBottom: 5,
            overflow: 'visible',
            elevation: 8,
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
          },
          tabBarLabelStyle: {
            fontSize: 9,
            fontWeight: '600',
            marginTop: 0,
          },
          tabBarItemStyle: {
            paddingVertical: 0,
            overflow: 'visible',
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarLabel: 'Home',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'home' : 'home-outline'}
                color={color}
                size={21}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="history"
          options={{
            title: 'History',
            tabBarLabel: 'History',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'time' : 'time-outline'}
                color={color}
                size={21}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="scan"
          options={{
            title: 'Scan',
            tabBarLabel: 'Scan',
            href: isStudent ? '/scan' : null,
            tabBarIcon: ({ focused }) =>
              isStudent ? (
                <AnimatedScanIcon focused={focused} color={COLORS.primary} />
              ) : (
                <Ionicons
                  name={focused ? 'scan' : 'qr-code-outline'}
                  color={COLORS.textSecondary}
                  size={21}
                />
              ),
          }}
        />

        <Tabs.Screen
          name="teacher"
          options={{
            title: isStudent ? 'Available Events' : 'Create Event',
            tabBarLabel: isStudent ? 'Available Events' : 'Create Event',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={
                  isStudent
                    ? focused
                      ? 'calendar'
                      : 'calendar-outline'
                    : focused
                      ? 'clipboard'
                      : 'clipboard-outline'
                }
                color={color}
                size={21}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarLabel: 'Profile',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'person' : 'person-outline'}
                color={color}
                size={21}
              />
            ),
          }}
        />
      </Tabs>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  scanButtonWrapper: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -25,
    zIndex: 10,
  },
  scanPulseRing: {
    position: 'absolute',
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  scanIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderWidth: 3,
    borderColor: COLORS.card,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
  },
  scanIconContainerFocused: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    borderColor: '#FFFFFF',
    elevation: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
  },
});