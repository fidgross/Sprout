import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Theme, ThemeWithContent, ContentWithSummary } from '@curator/shared';

/**
 * Fetch active (non-expired) themes.
 * Returns themes with their associated topic information.
 */
export function useActiveThemes() {
  return useQuery({
    queryKey: ['themes', 'active'],
    queryFn: async (): Promise<(Theme & { topic: { id: string; name: string; icon: string | null } })[]> => {
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from('themes')
        .select(`
          *,
          topic:topics(id, name, icon)
        `)
        .gt('expires_at', now)
        .order('detected_at', { ascending: false });

      if (error) throw error;
      return (data || []) as (Theme & { topic: { id: string; name: string; icon: string | null } })[];
    },
    staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
  });
}

/**
 * Fetch a single theme with its full content details.
 */
export function useThemeWithContent(themeId: string | null) {
  return useQuery({
    queryKey: ['themes', 'detail', themeId],
    queryFn: async (): Promise<ThemeWithContent | null> => {
      if (!themeId) return null;

      // Fetch the theme with topic
      const { data: theme, error: themeError } = await supabase
        .from('themes')
        .select(`
          *,
          topic:topics(*)
        `)
        .eq('id', themeId)
        .single();

      if (themeError) throw themeError;
      if (!theme) return null;

      // Fetch the content details
      const contentIds = theme.content_ids as string[];

      if (contentIds.length === 0) {
        return {
          ...theme,
          content: [],
        } as ThemeWithContent;
      }

      const { data: content, error: contentError } = await supabase
        .from('content')
        .select(`
          *,
          source:sources(*),
          summary:summaries(*)
        `)
        .in('id', contentIds);

      if (contentError) throw contentError;

      // Sort content to match the order in content_ids
      const contentMap = new Map(
        (content || []).map((c) => [c.id, c])
      );
      const orderedContent = contentIds
        .map((id) => contentMap.get(id))
        .filter((c): c is NonNullable<typeof c> => c !== undefined);

      return {
        ...theme,
        content: orderedContent as ContentWithSummary[],
      } as ThemeWithContent;
    },
    enabled: !!themeId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch themes for a specific topic.
 */
export function useThemesForTopic(topicId: string | null) {
  return useQuery({
    queryKey: ['themes', 'topic', topicId],
    queryFn: async (): Promise<Theme[]> => {
      if (!topicId) return [];

      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from('themes')
        .select('*')
        .eq('topic_id', topicId)
        .gt('expires_at', now)
        .order('detected_at', { ascending: false });

      if (error) throw error;
      return (data || []) as Theme[];
    },
    enabled: !!topicId,
    staleTime: 5 * 60 * 1000,
  });
}
