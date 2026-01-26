import { Stack } from 'expo-router';

export default function ContentLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#0f172a',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: '600',
        },
        contentStyle: {
          backgroundColor: '#0f172a',
        },
      }}
    >
      <Stack.Screen
        name="[id]"
        options={{
          title: '',
          headerBackTitle: 'Back',
        }}
      />
    </Stack>
  );
}
