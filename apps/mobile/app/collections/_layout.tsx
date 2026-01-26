import { Stack } from 'expo-router';

export default function CollectionsLayout() {
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
        name="index"
        options={{
          title: 'My Collections',
          headerBackTitle: 'Library',
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: '',
          headerBackTitle: 'Collections',
        }}
      />
    </Stack>
  );
}
