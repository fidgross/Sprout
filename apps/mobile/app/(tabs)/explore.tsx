import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SearchBar } from '../../components/SearchBar';
import { ContentCard } from '../../components/ContentCard';
import { TopicPicker } from '../../components/TopicPicker';
import { useSearch } from '../../hooks/useSearch';
import { useActiveThemes } from '../../hooks/useThemes';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { ContentWithSummary, Theme } from '@curator/shared';

interface ThemeWithTopic extends Theme {
  topic: { id: string; name: string; icon: string | null };
}

function TrendingSection({
  themes,
  isLoading,
}: {
  themes: ThemeWithTopic[];
  isLoading: boolean;
}) {
  const router = useRouter();

  if (isLoading) {
    return (
      <View style={styles.trendingSection}>
        <Text style={styles.sectionTitle}>Trending</Text>
        <View style={styles.trendingLoading}>
          <ActivityIndicator size="small" color="#3b82f6" />
        </View>
      </View>
    );
  }

  if (themes.length === 0) {
    return null;
  }

  return (
    <View style={styles.trendingSection}>
      <Text style={styles.sectionTitle}>Trending</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.trendingScrollContent}
      >
        {themes.map((theme) => (
          <TouchableOpacity
            key={theme.id}
            style={styles.trendingCard}
            onPress={() => router.push(`/content/${theme.content_ids[0]}`)}
            activeOpacity={0.7}
          >
            <View style={styles.trendingBadge}>
              <Text style={styles.trendingBadgeText}>
                {theme.topic?.icon || '#'} {theme.topic?.name || 'Topic'}
              </Text>
            </View>
            <Text style={styles.trendingTitle} numberOfLines={2}>
              {theme.title}
            </Text>
            <Text style={styles.trendingMeta}>
              {theme.content_ids.length} articles
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

export default function ExploreScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: searchResults, isLoading, error } = useSearch(searchQuery);
  const { data: themes = [], isLoading: themesLoading } = useActiveThemes();
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
        <ScrollView style={styles.browseContainer} showsVerticalScrollIndicator={false}>
          <TrendingSection themes={themes as ThemeWithTopic[]} isLoading={themesLoading} />
          <Text style={styles.sectionTitle}>Browse by Topic</Text>
          <TopicPicker
            selectedTopicIds={selectedTopicIds}
            onToggle={toggleTopic}
          />
        </ScrollView>
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
  // Trending section styles
  trendingSection: {
    marginBottom: 8,
  },
  trendingLoading: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    alignItems: 'center',
  },
  trendingScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 12,
  },
  trendingCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    width: 200,
    borderWidth: 1,
    borderColor: '#334155',
  },
  trendingBadge: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  trendingBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  trendingTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    lineHeight: 22,
  },
  trendingMeta: {
    color: '#94a3b8',
    fontSize: 13,
  },
});
