import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { TopicPicker } from '../../components/TopicPicker';
import { useSetUserTopics } from '../../hooks/useUserTopics';
import { useCompleteOnboarding } from '../../hooks/useOnboarding';

export default function TopicsScreen() {
  const router = useRouter();
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const setUserTopics = useSetUserTopics();
  const completeOnboarding = useCompleteOnboarding();

  const handleToggle = (topicId: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topicId)
        ? prev.filter((id) => id !== topicId)
        : [...prev, topicId]
    );
  };

  const handleContinue = async () => {
    if (selectedTopics.length === 0) {
      Alert.alert('Select Topics', 'Please select at least one topic to continue.');
      return;
    }

    try {
      await setUserTopics.mutateAsync(selectedTopics);
      await completeOnboarding.mutateAsync();
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const isLoading = setUserTopics.isPending || completeOnboarding.isPending;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>What interests you?</Text>
        <Text style={styles.subtitle}>
          Select topics you want to follow. You can change these anytime.
        </Text>
      </View>

      <View style={styles.picker}>
        <TopicPicker
          selectedTopicIds={selectedTopics}
          onToggle={handleToggle}
        />
      </View>

      <View style={styles.footer}>
        <Text style={styles.selectedCount}>
          {selectedTopics.length} topic{selectedTopics.length !== 1 ? 's' : ''} selected
        </Text>
        <TouchableOpacity
          style={[styles.button, selectedTopics.length === 0 && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={isLoading}
          accessibilityLabel="Continue to app"
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>
            {isLoading ? 'Saving...' : 'Continue'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    padding: 24,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    lineHeight: 22,
  },
  picker: {
    flex: 1,
  },
  footer: {
    padding: 24,
    gap: 12,
  },
  selectedCount: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#3b82f6',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
