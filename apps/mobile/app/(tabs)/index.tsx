import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useFeed } from '../../hooks/useContent';
import { useSaveContent, useDismissContent, useUnsaveContent } from '../../hooks/useUserContent';
import { ContentCard } from '../../components/ContentCard';
import type { ContentWithSummary } from '@curator/shared';

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
