import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTopics } from '../hooks/useContent';
import type { Topic } from '@curator/shared';

interface TopicPickerProps {
  selectedTopicIds: string[];
  onToggle: (topicId: string) => void;
  multiSelect?: boolean;
}

export function TopicPicker({ selectedTopicIds, onToggle, multiSelect = true }: TopicPickerProps) {
  const { data: topics, isLoading } = useTopics();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Loading topics...</Text>
      </View>
    );
  }

  const renderTopic = ({ item }: { item: Topic }) => {
    const isSelected = selectedTopicIds.includes(item.id);

    return (
      <TouchableOpacity
        style={[styles.topicCard, isSelected && styles.topicCardSelected]}
        onPress={() => onToggle(item.id)}
        accessibilityLabel={`${item.name}${isSelected ? ', selected' : ''}`}
        accessibilityRole="button"
      >
        <Text style={styles.topicIcon}>{item.icon || '📌'}</Text>
        <Text style={[styles.topicName, isSelected && styles.topicNameSelected]}>
          {item.name}
        </Text>
        {isSelected && (
          <View style={styles.checkmark}>
            <Ionicons name="checkmark-circle" size={20} color="#3b82f6" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <FlatList
      data={topics}
      renderItem={renderTopic}
      keyExtractor={(item) => item.id}
      numColumns={2}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
  },
  row: {
    gap: 12,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 16,
  },
  topicCard: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  topicCardSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#1e3a5f',
  },
  topicIcon: {
    fontSize: 32,
  },
  topicName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  topicNameSelected: {
    color: '#3b82f6',
  },
  checkmark: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
});
