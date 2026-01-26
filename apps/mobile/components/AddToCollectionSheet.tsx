import { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  useCollections,
  useAddToCollection,
  useContentCollections,
} from '../hooks/useCollections';
import { CreateCollectionModal } from './CreateCollectionModal';
import type { Collection } from '../hooks/useCollections';

interface AddToCollectionSheetProps {
  visible: boolean;
  contentId: string;
  onClose: () => void;
}

export function AddToCollectionSheet({
  visible,
  contentId,
  onClose,
}: AddToCollectionSheetProps) {
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const { data: collections, isLoading } = useCollections();
  const { data: contentCollections } = useContentCollections(contentId);
  const { mutate: addToCollection, isPending } = useAddToCollection();

  const handleSelectCollection = (collectionId: string) => {
    addToCollection(
      { collectionId, contentId },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  };

  const isInCollection = (collectionId: string) => {
    return contentCollections?.some((c) => c.id === collectionId) ?? false;
  };

  const renderCollectionItem = ({ item }: { item: Collection }) => {
    const alreadyAdded = isInCollection(item.id);

    return (
      <TouchableOpacity
        style={[styles.collectionItem, alreadyAdded && styles.collectionItemDisabled]}
        onPress={() => !alreadyAdded && handleSelectCollection(item.id)}
        disabled={alreadyAdded || isPending}
        accessibilityLabel={
          alreadyAdded
            ? `${item.name}, already added`
            : `Add to ${item.name}`
        }
        accessibilityRole="button"
      >
        <View style={[styles.iconContainer, alreadyAdded && styles.iconContainerAdded]}>
          <Ionicons
            name={alreadyAdded ? 'checkmark' : 'folder'}
            size={20}
            color={alreadyAdded ? '#22c55e' : '#3b82f6'}
          />
        </View>
        <View style={styles.itemInfo}>
          <Text style={styles.collectionName}>{item.name}</Text>
          <Text style={styles.itemCount}>
            {item.item_count} {item.item_count === 1 ? 'item' : 'items'}
          </Text>
        </View>
        {!alreadyAdded && (
          <Ionicons name="add-circle-outline" size={24} color="#3b82f6" />
        )}
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="folder-open-outline" size={48} color="#334155" />
      <Text style={styles.emptyTitle}>No collections yet</Text>
      <Text style={styles.emptySubtitle}>
        Create your first collection to start organizing content
      </Text>
    </View>
  );

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={onClose}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.sheetContainer}>
          <View style={styles.sheet}>
            {/* Handle bar */}
            <View style={styles.handleBar} />

            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Add to Collection</Text>
              <TouchableOpacity
                onPress={onClose}
                accessibilityLabel="Close"
                accessibilityRole="button"
              >
                <Ionicons name="close" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {/* Content */}
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3b82f6" />
              </View>
            ) : (
              <>
                {/* Create new collection button */}
                <TouchableOpacity
                  style={styles.createButton}
                  onPress={() => setIsCreateModalVisible(true)}
                  accessibilityLabel="Create new collection"
                  accessibilityRole="button"
                >
                  <View style={styles.createIconContainer}>
                    <Ionicons name="add" size={24} color="#3b82f6" />
                  </View>
                  <Text style={styles.createButtonText}>Create New Collection</Text>
                </TouchableOpacity>

                {/* Divider */}
                <View style={styles.divider} />

                {/* Collections list */}
                {!collections || collections.length === 0 ? (
                  renderEmptyState()
                ) : (
                  <FlatList
                    data={collections}
                    renderItem={renderCollectionItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    accessibilityLabel="Collections list"
                  />
                )}
              </>
            )}
          </View>
        </View>
      </Modal>

      <CreateCollectionModal
        visible={isCreateModalVisible}
        onClose={() => setIsCreateModalVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sheetContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '70%',
  },
  sheet: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  handleBar: {
    width: 36,
    height: 4,
    backgroundColor: '#475569',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  createIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderStyle: 'dashed',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#3b82f6',
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginHorizontal: 16,
  },
  listContent: {
    padding: 8,
  },
  collectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 12,
  },
  collectionItemDisabled: {
    opacity: 0.6,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainerAdded: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
  },
  itemInfo: {
    flex: 1,
  },
  collectionName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  itemCount: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
    textAlign: 'center',
  },
});
