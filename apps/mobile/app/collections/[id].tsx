import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useCollectionById,
  useCollectionItems,
  useDeleteCollection,
  useRemoveFromCollection,
} from '../../hooks/useCollections';
import { ContentCard } from '../../components/ContentCard';
import { useSaveContent, useUnsaveContent } from '../../hooks/useUserContent';
import type { CollectionItem } from '../../hooks/useCollections';
import type { ContentWithSummary } from '@curator/shared';

export default function CollectionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const {
    data: collection,
    isLoading: collectionLoading,
    error: collectionError,
  } = useCollectionById(id || '');

  const {
    data: items,
    isLoading: itemsLoading,
    error: itemsError,
    refetch,
    isRefetching,
  } = useCollectionItems(id || '');

  const { mutate: deleteCollection, isPending: isDeleting } = useDeleteCollection();
  const { mutate: removeFromCollection } = useRemoveFromCollection();
  const { mutate: saveContent } = useSaveContent();
  const { mutate: unsaveContent } = useUnsaveContent();

  const handleDeleteCollection = () => {
    Alert.alert(
      'Delete Collection',
      `Are you sure you want to delete "${collection?.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (id) {
              deleteCollection(id, {
                onSuccess: () => {
                  router.back();
                },
              });
            }
          },
        },
      ]
    );
  };

  const handleRemoveItem = (contentId: string) => {
    if (!id) return;
    Alert.alert(
      'Remove from Collection',
      'Remove this item from the collection?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            removeFromCollection({ collectionId: id, contentId });
          },
        },
      ]
    );
  };

  const handleContentPress = (contentId: string) => {
    router.push(`/content/${contentId}`);
  };

  const handleSaveToggle = (content: ContentWithSummary) => {
    if (content.user_content?.status === 'saved') {
      unsaveContent(content.id);
    } else {
      saveContent(content.id);
    }
  };

  const renderContentItem = ({ item }: { item: CollectionItem }) => (
    <View style={styles.itemWrapper}>
      <ContentCard
        content={item.content}
        onPress={() => handleContentPress(item.content.id)}
        onSave={() => handleSaveToggle(item.content)}
        onDismiss={() => handleRemoveItem(item.content_id)}
      />
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="document-outline" size={64} color="#334155" />
      <Text style={styles.emptyTitle}>No items in this collection</Text>
      <Text style={styles.emptySubtitle}>
        Add content to this collection from your feed or saved items
      </Text>
    </View>
  );

  const isLoading = collectionLoading || itemsLoading;
  const error = collectionError || itemsError;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer} accessibilityLabel="Loading collection">
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (error || !collection) {
    return (
      <View style={styles.errorContainer} accessibilityRole="alert">
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text style={styles.errorText}>Failed to load collection</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => router.back()}
        >
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const itemsList = items ?? [];

  return (
    <>
      <Stack.Screen
        options={{
          title: collection.name,
          headerRight: () => (
            <TouchableOpacity
              onPress={handleDeleteCollection}
              disabled={isDeleting}
              accessibilityLabel="Delete collection"
              accessibilityRole="button"
              style={styles.headerButton}
            >
              <Ionicons
                name="trash-outline"
                size={22}
                color={isDeleting ? '#64748b' : '#ef4444'}
              />
            </TouchableOpacity>
          ),
        }}
      />
      <View style={styles.container}>
        {/* Collection Header */}
        {collection.description ? (
          <View style={styles.descriptionContainer}>
            <Text style={styles.description}>{collection.description}</Text>
          </View>
        ) : null}

        {/* Item count */}
        <View style={styles.countContainer}>
          <Text style={styles.countText}>
            {itemsList.length} {itemsList.length === 1 ? 'item' : 'items'}
          </Text>
        </View>

        {/* Content list */}
        {itemsList.length === 0 ? (
          renderEmptyState()
        ) : (
          <FlatList
            data={itemsList}
            renderItem={renderContentItem}
            keyExtractor={(item) => item.content_id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={refetch}
                tintColor="#3b82f6"
                colors={['#3b82f6']}
              />
            }
            accessibilityLabel="Collection items list"
          />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
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
  headerButton: {
    padding: 8,
  },
  descriptionContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  description: {
    fontSize: 15,
    color: '#94a3b8',
    lineHeight: 22,
  },
  countContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  countText: {
    fontSize: 14,
    color: '#64748b',
  },
  listContent: {
    paddingVertical: 8,
  },
  itemWrapper: {
    // Override ContentCard margins for this context
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
});
