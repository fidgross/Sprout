import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SearchBar } from '../../components/SearchBar';
import { ContentCard } from '../../components/ContentCard';
import { TopicPicker } from '../../components/TopicPicker';
import { useSearch } from '../../hooks/useSearch';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { ContentWithSummary } from '@curator/shared';

export default function ExploreScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: searchResults, isLoading, error } = useSearch(searchQuery);
  const isSearchActive = searchQuery.trim().length > 0;

  const toggleTopic = useCallback((topicId: string) => {
    setSelectedTopicIds((prev) =>
      prev.includes(topicId)
        ? prev.filter((id) => id !== topicId)
        : [...prev, topicId]
    );
  }, []);

  const saveContentMutation = useMutation({
    mutationFn: async (contentId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('user_content')
        .upsert({
          user_id: user.id,
          content_id: contentId,
          status: 'saved',
          saved_at: new Date().toISOString(),
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['search'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });

  const dismissContentMutation = useMutation({
    mutationFn: async (contentId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('user_content')
        .upsert({
          user_id: user.id,
          content_id: contentId,
          status: 'dismissed',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['search'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });

  const handleContentPress = useCallback(
    (contentId: string) => {
      router.push(`/content/${contentId}`);
    },
    [router]
  );

  const handleSave = useCallback(
    (contentId: string) => {
      saveContentMutation.mutate(contentId);
    },
    [saveContentMutation]
  );

  const handleDismiss = useCallback(
    (contentId: string) => {
      dismissContentMutation.mutate(contentId);
    },
    [dismissContentMutation]
  );

  const renderSearchResult = useCallback(
    ({ item }: { item: ContentWithSummary }) => (
      <ContentCard
        content={item}
        onPress={() => handleContentPress(item.id)}
        onSave={() => handleSave(item.id)}
        onDismiss={() => handleDismiss(item.id)}
      />
    ),
    [handleContentPress, handleSave, handleDismiss]
  );

  const renderEmptyState = () => {
    if (isLoading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Error searching content</Text>
          <Text style={styles.errorDetail}>
            {error instanceof Error ? error.message : 'Unknown error'}
          </Text>
        </View>
      );
    }

    if (isSearchActive && searchResults?.results.length === 0) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.noResultsText}>No results found</Text>
          <Text style={styles.noResultsSubtext}>
            Try different keywords or explore topics below
          </Text>
        </View>
      );
    }

    return null;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Explore</Text>
      </View>

      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search articles, podcasts, videos..."
      />

      {isSearchActive ? (
        <FlatList
          data={searchResults?.results || []}
          renderItem={renderSearchResult}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.searchResultsList}
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.browseContainer}>
          <Text style={styles.sectionTitle}>Browse by Topic</Text>
          <TopicPicker
            selectedTopicIds={selectedTopicIds}
            onToggle={toggleTopic}
          />
        </View>
      )}
    </SafeAreaView>
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
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  browseContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchResultsList: {
    paddingBottom: 24,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 16,
    color: '#94a3b8',
    marginTop: 12,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ef4444',
    marginBottom: 8,
  },
  errorDetail: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
  noResultsText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  noResultsSubtext: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
});
