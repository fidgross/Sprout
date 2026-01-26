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
import { useCollections } from '../../hooks/useCollections';
import { ContentCard } from '../../components/ContentCard';
import { HighlightCard } from '../../components/HighlightCard';
import type { ContentWithSummary } from '@curator/shared';
import type { HighlightWithContent } from '../../hooks/useUserContent';
import type { Collection } from '../../hooks/useCollections';

type Segment = 'saved' | 'history' | 'notes' | 'collections';

interface SegmentOption {
  key: Segment;
  label: string;
  icon: string;
}

const SEGMENTS: SegmentOption[] = [
  { key: 'saved', label: 'Saved', icon: 'bookmark' },
  { key: 'history', label: 'History', icon: 'time' },
  { key: 'notes', label: 'Notes', icon: 'document-text' },
  { key: 'collections', label: 'Collections', icon: 'folder' },
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

  const {
    data: collections,
    isLoading: collectionsLoading,
    error: collectionsError,
    refetch: refetchCollections,
    isRefetching: isRefetchingCollections,
  } = useCollections();

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

  const handleCollectionPress = (collectionId: string) => {
    router.push(`/collections/${collectionId}`);
  };

  const renderCollectionItem = ({ item }: { item: Collection }) => (
    <TouchableOpacity
      style={styles.collectionCard}
      onPress={() => handleCollectionPress(item.id)}
      accessibilityLabel={`${item.name}, ${item.item_count} items`}
      accessibilityHint="Tap to view collection contents"
    >
      <View style={styles.collectionCardContent}>
        <View style={styles.collectionIcon}>
          <Ionicons name="folder" size={24} color="#3b82f6" />
        </View>
        <View style={styles.collectionInfo}>
          <Text style={styles.collectionName} numberOfLines={1}>
            {item.name}
          </Text>
          {item.description ? (
            <Text style={styles.collectionDescription} numberOfLines={1}>
              {item.description}
            </Text>
          ) : null}
          <Text style={styles.collectionItemCount}>
            {item.item_count} {item.item_count === 1 ? 'item' : 'items'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#64748b" />
      </View>
    </TouchableOpacity>
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

  const renderCollectionsSection = () => {
    if (collectionsLoading) return renderLoading();
    if (collectionsError) return renderError(refetchCollections);

    const collectionsList = collections ?? [];
    if (collectionsList.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="folder-open-outline" size={64} color="#334155" />
          <Text style={styles.emptyTitle}>No collections yet</Text>
          <Text style={styles.emptySubtitle}>
            Create collections to organize your content
          </Text>
          <TouchableOpacity
            style={styles.viewAllButton}
            onPress={() => router.push('/collections')}
            accessibilityLabel="Create your first collection"
            accessibilityRole="button"
          >
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.viewAllButtonText}>Create Collection</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.collectionsContainer}>
        <FlatList
          data={collectionsList}
          renderItem={renderCollectionItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.collectionsListContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefetchingCollections}
              onRefresh={refetchCollections}
              tintColor="#3b82f6"
              colors={['#3b82f6']}
            />
          }
          ListFooterComponent={
            <TouchableOpacity
              style={styles.viewAllCollectionsButton}
              onPress={() => router.push('/collections')}
              accessibilityLabel="View all collections"
              accessibilityRole="button"
            >
              <Text style={styles.viewAllCollectionsText}>View All Collections</Text>
              <Ionicons name="arrow-forward" size={18} color="#3b82f6" />
            </TouchableOpacity>
          }
          accessibilityLabel="Collections list"
        />
      </View>
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
      case 'collections':
        return renderCollectionsSection();
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
  collectionsContainer: {
    flex: 1,
  },
  collectionsListContent: {
    padding: 16,
  },
  collectionCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  collectionCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  collectionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  collectionInfo: {
    flex: 1,
    marginRight: 8,
  },
  collectionName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  collectionDescription: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 4,
  },
  collectionItemCount: {
    fontSize: 13,
    color: '#64748b',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#3b82f6',
    borderRadius: 12,
  },
  viewAllButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  viewAllCollectionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    marginTop: 8,
  },
  viewAllCollectionsText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#3b82f6',
  },
});
