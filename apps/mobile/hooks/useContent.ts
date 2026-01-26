import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { ContentWithSummary, SourceType } from '@curator/shared';

interface FeedFilters {
  sourceType?: SourceType;
  topicId?: string;
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
          summary:summaries(*)
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
