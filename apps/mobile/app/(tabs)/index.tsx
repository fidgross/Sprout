import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useFeed } from '../../hooks/useContent';
import { useSaveContent, useDismissContent, useUnsaveContent } from '../../hooks/useUserContent';
import { useTodayDigest, useMarkDigestOpened } from '../../hooks/useDigest';
import { ContentCard } from '../../components/ContentCard';
import type { ContentWithSummary } from '@curator/shared';

function DigestSection() {
  const router = useRouter();
  const { data: digest, isLoading } = useTodayDigest();
  const { mutate: markOpened } = useMarkDigestOpened();

  const handleDigestPress = () => {
    if (digest) {
      // Mark as opened if not already
      if (!digest.opened_at) {
        markOpened(digest.id);
      }
      // Navigate to first content item
      if (digest.content.length > 0) {
        router.push(`/content/${digest.content[0].id}`);
      }
    }
  };

  if (isLoading) {
    return (
      <View style={digestStyles.container}>
        <View style={digestStyles.loadingContainer}>
          <ActivityIndicator size="small" color="#3b82f6" />
        </View>
      </View>
    );
  }

  if (!digest || digest.content.length === 0) {
    return null;
  }

  const isNew = !digest.opened_at;
  const itemCount = digest.content.length;
  const firstItem = digest.content[0];

  return (
    <TouchableOpacity
      style={digestStyles.container}
      onPress={handleDigestPress}
      activeOpacity={0.8}
      accessibilityLabel={`Your daily digest with ${itemCount} items`}
      accessibilityRole="button"
    >
      <View style={digestStyles.header}>
        <View style={digestStyles.titleRow}>
          <Text style={digestStyles.title}>Your Daily Digest</Text>
          {isNew && (
            <View style={digestStyles.badge}>
              <Text style={digestStyles.badgeText}>New</Text>
            </View>
          )}
        </View>
        <Text style={digestStyles.itemCount}>
          {itemCount} {itemCount === 1 ? 'item' : 'items'} for you
        </Text>
      </View>

      <View style={digestStyles.preview}>
        <Text style={digestStyles.previewTitle} numberOfLines={2}>
          {firstItem.summary?.headline || firstItem.title}
        </Text>
        <Text style={digestStyles.previewSource}>
          {firstItem.source?.name} {itemCount > 1 ? `and ${itemCount - 1} more` : ''}
        </Text>
      </View>

      <View style={digestStyles.footer}>
        <Text style={digestStyles.tapToView}>Tap to view digest</Text>
      </View>
    </TouchableOpacity>
  );
}

const digestStyles = StyleSheet.create({
  container: {
    backgroundColor: '#1e293b',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  loadingContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  header: {
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  badge: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  itemCount: {
    fontSize: 14,
    color: '#94a3b8',
  },
  preview: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#e2e8f0',
    marginBottom: 4,
  },
  previewSource: {
    fontSize: 13,
    color: '#64748b',
  },
  footer: {
    alignItems: 'center',
  },
  tapToView: {
    fontSize: 13,
    color: '#3b82f6',
    fontWeight: '600',
  },
});

export default function HomeScreen() {
  const router = useRouter();
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isRefetching,
  } = useFeed();
  const { mutate: saveContent } = useSaveContent();
  const { mutate: unsaveContent } = useUnsaveContent();
  const { mutate: dismissContent } = useDismissContent();

  const allContent = data?.pages.flat() ?? [];

  const handleCardPress = (contentId: string) => {
    router.push(`/content/${contentId}`);
  };

  const handleSave = (content: ContentWithSummary) => {
    if (content.user_content?.status === 'saved') {
      unsaveContent(content.id);
    } else {
      saveContent(content.id);
    }
  };

  const handleDismiss = (contentId: string) => {
    dismissContent(contentId);
  };

  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const renderItem = ({ item }: { item: ContentWithSummary }) => (
    <ContentCard
      content={item}
      onPress={() => handleCardPress(item.id)}
      onSave={() => handleSave(item)}
      onDismiss={() => handleDismiss(item.id)}
    />
  );

  const renderHeader = () => <DigestSection />;

  const renderFooter = () => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color="#3b82f6" />
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer} accessibilityLabel="Loading feed">
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer} accessibilityRole="alert">
        <Text style={styles.errorText}>Failed to load feed</Text>
        <Text style={styles.errorSubtext}>Pull down to retry</Text>
      </View>
    );
  }

  if (allContent.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.title}>Your Feed</Text>
        <Text style={styles.subtitle}>Content will appear here</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      data={allContent}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={renderHeader}
      onEndReached={handleLoadMore}
      onEndReachedThreshold={0.5}
      ListFooterComponent={renderFooter}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor="#3b82f6"
          colors={['#3b82f6']}
        />
      }
      accessibilityLabel="Content feed"
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  contentContainer: {
    paddingVertical: 8,
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
    padding: 24,
  },
  errorText: {
    fontSize: 18,
    color: '#ef4444',
    fontWeight: '600',
  },
  errorSubtext: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 8,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    marginTop: 8,
  },
  loadingFooter: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});
