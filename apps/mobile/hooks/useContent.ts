import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { ContentWithSummary, SourceType } from '@curator/shared';

interface FeedFilters {
  sourceType?: SourceType;
  topicId?: string;
}

interface PersonalizedFeedFilters extends FeedFilters {
  // Additional filters for personalized feed if needed
}

interface ScoredContent extends ContentWithSummary {
  personalization_score: number;
  score_breakdown: {
    base_score: number;
    topic_match: number;
    recency_boost: number;
  };
}

interface PersonalizedFeedResponse {
  items: ScoredContent[];
  hasMore: boolean;
  total: number;
}

export function useFeed(filters?: FeedFilters) {
  return useInfiniteQuery({
    queryKey: ['feed', filters],
    queryFn: async ({ pageParam = 0 }) => {
      let query = supabase
        .from('content')
        .select(`
          *,
          source:sources(*),
          summary:summaries(*),
          user_content:user_content(*)
        `)
        .order('published_at', { ascending: false })
        .range(pageParam, pageParam + 19);

      if (filters?.sourceType) {
        query = query.eq('source.type', filters.sourceType);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as ContentWithSummary[];
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < 20) return undefined;
      return allPages.length * 20;
    },
    initialPageParam: 0,
  });
}

export function useContentById(contentId: string) {
  return useQuery({
    queryKey: ['content', contentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content')
        .select(`
          *,
          source:sources(*),
          summary:summaries(*),
          user_content:user_content(*)
        `)
        .eq('id', contentId)
        .single();

      if (error) throw error;
      return data as ContentWithSummary;
    },
    enabled: !!contentId,
  });
}

export function useTopics() {
  return useQuery({
    queryKey: ['topics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('topics')
        .select('*')
        .order('name');

      if (error) throw error;
      return data;
    },
  });
}

export function useSources() {
  return useQuery({
    queryKey: ['sources'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sources')
        .select('*')
        .order('name');

      if (error) throw error;
      return data;
    },
  });
}

/**
 * Personalized feed hook that fetches content scored and sorted by relevance.
 * Uses the personalized-feed edge function for scoring based on:
 * - Source quality score
 * - User's topic preferences
 * - Content recency
 */
export function usePersonalizedFeed(filters?: PersonalizedFeedFilters) {
  return useInfiniteQuery({
    queryKey: ['personalizedFeed', filters],
    queryFn: async ({ pageParam = 0 }) => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated');
      }

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured');
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/personalized-feed`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            limit: 20,
            offset: pageParam,
            sourceType: filters?.sourceType,
            topicId: filters?.topicId,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || 'Failed to fetch personalized feed');
      }

      const data: PersonalizedFeedResponse = await response.json();
      return data;
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined;
      return allPages.reduce((total, page) => total + page.items.length, 0);
    },
    initialPageParam: 0,
  });
}

export type { ScoredContent, PersonalizedFeedResponse };
