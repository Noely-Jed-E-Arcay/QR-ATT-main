import { Stack } from 'expo-router';
import { COLORS } from '@/constants/colors';

export default function AdministratorLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.card,
        },
        headerTintColor: COLORS.textPrimary,
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 17,
        },
        headerShadowVisible: false,
        contentStyle: {
          backgroundColor: COLORS.background,
        },
        headerBackTitle: 'Back',
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Administrator Dashboard',
          headerBackVisible: false,
        }}
      />

      <Stack.Screen
        name="users"
        options={{
          title: 'User Management',
        }}
      />

      <Stack.Screen
        name="events"
        options={{
          title: 'Event Management',
        }}
      />

      <Stack.Screen
        name="attendance"
        options={{
          title: 'Attendance Records',
        }}
      />

      <Stack.Screen
        name="reports"
        options={{
          title: 'Reports',
        }}
      />

      <Stack.Screen
        name="teacher-requests"
        options={{
          title: 'Teacher Verification',
        }}
      />
    </Stack>
  );
}