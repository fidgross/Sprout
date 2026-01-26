import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSavedContent, useUnsaveContent, useHistory, useHighlights, useSaveContent } from '../../hooks/useUserContent';
import { ContentCard } from '../../components/ContentCard';
import { HighlightCard } from '../../components/HighlightCard';
import type { ContentWithSummary } from '@curator/shared';
import type { HighlightWithContent } from '../../hooks/useUserContent';

type Segment = 'saved' | 'history' | 'notes';

interface SegmentOption {
  key: Segment;
  label: string;
  icon: string;
}

const SEGMENTS: SegmentOption[] = [
  { key: 'saved', label: 'Saved', icon: 'bookmark' },
  { key: 'history', label: 'History', icon: 'time' },
  { key: 'notes', label: 'Notes', icon: 'document-text' },
];

export default function LibraryScreen() {
  const router = useRouter();
  const [selectedSegment, setSelectedSegment] = useState<Segment>('saved');

  // Hooks for each section
  const {
    data: savedContent,
    isLoading: savedLoading,
    error: savedError,
    refetch: refetchSaved,
    isRefetching: isRefetchingSaved,
  } = useSavedContent();

  const {
    data: historyContent,
    isLoading: historyLoading,
    error: historyError,
    refetch: refetchHistory,
    isRefetching: isRefetchingHistory,
  } = useHistory();

  const {
    data: highlights,
    isLoading: highlightsLoading,
    error: highlightsError,
    refetch: refetchHighlights,
    isRefetching: isRefetchingHighlights,
  } = useHighlights();

  const { mutate: unsaveContent } = useUnsaveContent();
  const { mutate: saveContent } = useSaveContent();

  const handleCardPress = (contentId: string) => {
    router.push(`/content/${contentId}`);
  };

  const handleSaveToggle = (content: ContentWithSummary) => {
    if (content.user_content?.status === 'saved') {
      unsaveContent(content.id);
    } else {
      saveContent(content.id);
    }
  };

  const handleDismiss = () => {
    // In library context, we don't dismiss, we just unsave
    // This is a no-op for ContentCard compatibility
  };

  const renderSegmentControl = () => (
    <View style={styles.segmentContainer} accessibilityRole="tablist">
      {SEGMENTS.map((segment) => {
        const isSelected = selectedSegment === segment.key;
        return (
          <TouchableOpacity
            key={segment.key}
            style={[styles.segmentButton, isSelected && styles.segmentButtonActive]}
            onPress={() => setSelectedSegment(segment.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={segment.label}
          >
            <Ionicons
              name={segment.icon as any}
              size={18}
              color={isSelected ? '#fff' : '#64748b'}
            />
            <Text style={[styles.segmentText, isSelected && styles.segmentTextActive]}>
              {segment.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderEmptyState = (title: string, subtitle: string, icon: string) => (
    <View style={styles.emptyContainer}>
      <Ionicons name={icon as any} size={64} color="#334155" />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
    </View>
  );

  const renderLoading = () => (
    <View style={styles.loadingContainer} accessibilityLabel="Loading content">
      <ActivityIndicator size="large" color="#3b82f6" />
    </View>
  );

  const renderError = (onRetry: () => void) => (
    <View style={styles.errorContainer} accessibilityRole="alert">
      <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
      <Text style={styles.errorText}>Failed to load content</Text>
      <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
        <Text style={styles.retryButtonText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );

  const renderContentItem = ({ item }: { item: ContentWithSummary }) => (
    <ContentCard
      content={item}
      onPress={() => handleCardPress(item.id)}
      onSave={() => handleSaveToggle(item)}
      onDismiss={handleDismiss}
    />
  );

  const renderHighlightItem = ({ item }: { item: HighlightWithContent }) => (
    <HighlightCard
      highlight={item}
      onPress={() => handleCardPress(item.content.id)}
    />
  );

  const renderSavedSection = () => {
    if (savedLoading) return renderLoading();
    if (savedError) return renderError(refetchSaved);

    const content = savedContent ?? [];
    if (content.length === 0) {
      return renderEmptyState(
        'No saved content',
        'Bookmark content from your feed to save it here',
        'bookmark-outline'
      );
    }

    return (
      <FlatList
        data={content}
        renderItem={renderContentItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetchingSaved}
            onRefresh={refetchSaved}
            tintColor="#3b82f6"
            colors={['#3b82f6']}
          />
        }
        accessibilityLabel="Saved content list"
      />
    );
  };

  const renderHistorySection = () => {
    if (historyLoading) return renderLoading();
    if (historyError) return renderError(refetchHistory);

    const content = historyContent ?? [];
    if (content.length === 0) {
      return renderEmptyState(
        'No reading history',
        'Content you read will appear here',
        'time-outline'
      );
    }

    return (
      <FlatList
        data={content}
        renderItem={renderContentItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetchingHistory}
            onRefresh={refetchHistory}
            tintColor="#3b82f6"
            colors={['#3b82f6']}
          />
        }
        accessibilityLabel="Reading history list"
      />
    );
  };

  const renderNotesSection = () => {
    if (highlightsLoading) return renderLoading();
    if (highlightsError) return renderError(refetchHighlights);

    const notes = highlights ?? [];
    if (notes.length === 0) {
      return renderEmptyState(
        'No highlights yet',
        'Highlight text while reading to save it here',
        'document-text-outline'
      );
    }

    return (
      <FlatList
        data={notes}
        renderItem={renderHighlightItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetchingHighlights}
            onRefresh={refetchHighlights}
            tintColor="#3b82f6"
            colors={['#3b82f6']}
          />
        }
        accessibilityLabel="Highlights list"
      />
    );
  };

  const renderContent = () => {
    switch (selectedSegment) {
      case 'saved':
        return renderSavedSection();
      case 'history':
        return renderHistorySection();
      case 'notes':
        return renderNotesSection();
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Library</Text>
      </View>
      {renderSegmentControl()}
      <View style={styles.contentArea}>{renderContent()}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  segmentContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 4,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  segmentButtonActive: {
    backgroundColor: '#3b82f6',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
  },
  segmentTextActive: {
    color: '#fff',
  },
  contentArea: {
    flex: 1,
    marginTop: 8,
  },
  listContent: {
    paddingVertical: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 8,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    marginTop: 12,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
