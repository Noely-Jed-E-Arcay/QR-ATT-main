import { Stack } from 'expo-router';

export default function AdministratorLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: 'Administrator',
        }}
      />

      <Stack.Screen
        name="users"
        options={{
          title: 'Users',
        }}
      />

      <Stack.Screen
        name="events"
        options={{
          title: 'Events',
        }}
      />

      <Stack.Screen
        name="attendance"
        options={{
          title: 'Attendance',
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