import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../lib/queryClient';
import { useAuth } from '../hooks/useAuth';
import { useOnboardingStatus } from '../hooks/useOnboarding';
import { View, ActivityIndicator } from 'react-native';

export default function RootLayout() {
  const { session, loading: authLoading } = useAuth();
  const { data: onboardingCompleted, isLoading: onboardingLoading } = useOnboardingStatus();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (authLoading || onboardingLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboardingGroup = segments[0] === '(onboarding)';

    if (!session && !inAuthGroup) {
      // Not logged in, go to auth
      router.replace('/(auth)/sign-in');
    } else if (session && inAuthGroup) {
      // Logged in but in auth screens, check onboarding
      if (onboardingCompleted === false) {
        router.replace('/(onboarding)/welcome');
      } else {
        router.replace('/(tabs)');
      }
    } else if (session && !inOnboardingGroup && onboardingCompleted === false) {
      // Logged in, not in onboarding, but onboarding not complete
      router.replace('/(onboarding)/welcome');
    } else if (session && inOnboardingGroup && onboardingCompleted === true) {
      // Logged in, in onboarding, but already completed
      router.replace('/(tabs)');
    }
  }, [session, authLoading, onboardingCompleted, onboardingLoading, segments]);

  if (authLoading || (session && onboardingLoading)) {
    return (
      <QueryClientProvider client={queryClient}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' }}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </QueryClientProvider>
  );
}
