import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { Digest, ContentWithSummary } from '@curator/shared';

/**
 * Get today's date in YYYY-MM-DD format (local timezone)
 */
function getTodayDate(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

export interface DigestWithContent extends Digest {
  content: ContentWithSummary[];
}

/**
 * Fetch today's digest for the current user.
 * Returns the digest with full content details.
 */
export function useTodayDigest() {
  const { user } = useAuth();
  const today = getTodayDate();

  return useQuery({
    queryKey: ['digest', 'today', user?.id, today],
    queryFn: async (): Promise<DigestWithContent | null> => {
      if (!user) return null;

      // Fetch today's digest
      const { data: digest, error: digestError } = await supabase
        .from('digests')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle();

      if (digestError) throw digestError;
      if (!digest) return null;

      // If we have a digest, fetch the full content details
      const contentIds = digest.content_ids as string[];

      if (contentIds.length === 0) {
        return {
          ...digest,
          content: [],
        } as DigestWithContent;
      }

      // Fetch content with sources and summaries
      const { data: content, error: contentError } = await supabase
        .from('content')
        .select(`
          *,
          source:sources(*),
          summary:summaries(*),
          user_content:user_content(*)
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
        ...digest,
        content: orderedContent as ContentWithSummary[],
      } as DigestWithContent;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
  });
}

/**
 * Mark a digest as opened (user viewed the digest)
 */
export function useMarkDigestOpened() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (digestId: string) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('digests')
        .update({ opened_at: new Date().toISOString() })
        .eq('id', digestId)
        .eq('user_id', user.id); // Ensure user owns this digest

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['digest'] });
    },
  });
}

/**
 * Get digest history (past digests)
 */
export function useDigestHistory(limit = 7) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['digest', 'history', user?.id, limit],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('digests')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as Digest[];
    },
    enabled: !!user,
  });
}
