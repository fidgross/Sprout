import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { ContentStatus } from '@curator/shared';

/**
 * Topic weight adjustment constants for implicit learning.
 * Adjusts user_topics.weight based on content interactions.
 */
const WEIGHT_ADJUSTMENTS = {
  read: 0.1,    // Read full summary -> boost topic +0.1
  save: 0.2,    // Saved item -> boost topic +0.2
  dismiss: -0.1, // Dismissed -> reduce topic -0.1
} as const;

const MIN_WEIGHT = 0.1;
const MAX_WEIGHT = 5.0;

type InteractionType = keyof typeof WEIGHT_ADJUSTMENTS;

/**
 * Update topic weights for a user based on content interaction.
 * Adjusts weights for all topics associated with the content's source.
 */
async function updateTopicWeightsForInteraction(
  userId: string,
  contentId: string,
  interaction: InteractionType
): Promise<void> {
  const adjustment = WEIGHT_ADJUSTMENTS[interaction];

  // Get content's source
  const { data: content, error: contentError } = await supabase
    .from('content')
    .select('source_id')
    .eq('id', contentId)
    .single();

  if (contentError || !content) {
    console.warn('Could not fetch content for topic weight update:', contentError);
    return;
  }

  // Get topics associated with this source
  const { data: sourceTopics, error: topicsError } = await supabase
    .from('source_topics')
    .select('topic_id')
    .eq('source_id', content.source_id);

  if (topicsError || !sourceTopics || sourceTopics.length === 0) {
    return;
  }

  const topicIds = sourceTopics.map((st) => st.topic_id);

  // Get user's current topic weights for these topics
  const { data: existingUserTopics } = await supabase
    .from('user_topics')
    .select('topic_id, weight')
    .eq('user_id', userId)
    .in('topic_id', topicIds);

  const existingMap = new Map(
    existingUserTopics?.map((ut) => [ut.topic_id, ut.weight]) ?? []
  );

  // Build batch upsert records for topic weight updates
  const upsertRecords: { user_id: string; topic_id: string; weight: number }[] = [];

  for (const topicId of topicIds) {
    const currentWeight = existingMap.get(topicId);

    if (currentWeight !== undefined) {
      // Update existing weight
      const newWeight = Math.max(
        MIN_WEIGHT,
        Math.min(MAX_WEIGHT, currentWeight + adjustment)
      );
      upsertRecords.push({
        user_id: userId,
        topic_id: topicId,
        weight: newWeight,
      });
    } else if (adjustment > 0) {
      // Only create new user_topic entry for positive interactions
      // (don't auto-follow topics just because user dismissed something)
      upsertRecords.push({
        user_id: userId,
        topic_id: topicId,
        weight: 1.0 + adjustment,
      });
    }
  }

  // Batch upsert all topic weight updates in a single operation
  if (upsertRecords.length > 0) {
    const { error } = await supabase
      .from('user_topics')
      .upsert(upsertRecords, { onConflict: 'user_id,topic_id' });

    if (error) {
      console.warn('Failed to batch update topic weights:', error);
    }
  }
}

export function useSaveContent() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (contentId: string) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('user_content')
        .upsert({
          user_id: user.id,
          content_id: contentId,
          status: 'saved' as ContentStatus,
          saved_at: new Date().toISOString(),
        });

      if (error) throw error;

      // Update topic weights for personalization (fire and forget)
      updateTopicWeightsForInteraction(user.id, contentId, 'save').catch(
        (err) => console.warn('Failed to update topic weights:', err)
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['personalizedFeed'] });
      queryClient.invalidateQueries({ queryKey: ['saved'] });
      queryClient.invalidateQueries({ queryKey: ['userTopics'] });
    },
  });
}

export function useDismissContent() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (contentId: string) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('user_content')
        .upsert({
          user_id: user.id,
          content_id: contentId,
          status: 'dismissed' as ContentStatus,
        });

      if (error) throw error;

      // Update topic weights for personalization (fire and forget)
      updateTopicWeightsForInteraction(user.id, contentId, 'dismiss').catch(
        (err) => console.warn('Failed to update topic weights:', err)
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['personalizedFeed'] });
      queryClient.invalidateQueries({ queryKey: ['userTopics'] });
    },
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (contentId: string) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('user_content')
        .upsert({
          user_id: user.id,
          content_id: contentId,
          status: 'read' as ContentStatus,
          read_at: new Date().toISOString(),
        });

      if (error) throw error;

      // Update topic weights for personalization (fire and forget)
      updateTopicWeightsForInteraction(user.id, contentId, 'read').catch(
        (err) => console.warn('Failed to update topic weights:', err)
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['personalizedFeed'] });
      queryClient.invalidateQueries({ queryKey: ['history'] });
      queryClient.invalidateQueries({ queryKey: ['userTopics'] });
    },
  });
}

export function useUnsaveContent() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (contentId: string) => {
      if (!user) throw new Error('Not authenticated');

      // When unsaving, change status to 'read' (moves from saved to history)
      const { error } = await supabase
        .from('user_content')
        .upsert({
          user_id: user.id,
          content_id: contentId,
          status: 'read' as ContentStatus,
          read_at: new Date().toISOString(),
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['saved'] });
      queryClient.invalidateQueries({ queryKey: ['history'] });
      queryClient.invalidateQueries({ queryKey: ['content'] });
    },
  });
}

export function useSavedContent() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['saved', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('user_content')
        .select(`
          content:content(
            *,
            source:sources(*),
            summary:summaries(*)
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'saved')
        .order('saved_at', { ascending: false });

      if (error) throw error;
      // The nested content is a single object (many-to-one), extract and type properly
      return data
        .filter(d => d.content !== null)
        .map(d => d.content) as unknown as import('@curator/shared').ContentWithSummary[];
    },
    enabled: !!user,
  });
}

export function useHistory() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['history', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('user_content')
        .select(`
          content:content(
            *,
            source:sources(*),
            summary:summaries(*)
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'read')
        .order('read_at', { ascending: false });

      if (error) throw error;
      // The nested content is a single object (many-to-one), extract and type properly
      return data
        .filter(d => d.content !== null)
        .map(d => d.content) as unknown as import('@curator/shared').ContentWithSummary[];
    },
    enabled: !!user,
  });
}

export interface HighlightWithContent {
  id: string;
  text: string;
  note: string | null;
  created_at: string;
  content: {
    id: string;
    title: string;
    source: {
      name: string;
      type: string;
    };
  };
}

export function useHighlights() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['highlights', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('highlights')
        .select(`
          id,
          text,
          note,
          created_at,
          content:content(
            id,
            title,
            source:sources(name, type)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform the data to match our interface
      // Supabase returns nested relations, we need to flatten them
      return data
        .filter(d => d.content !== null)
        .map(d => {
          const content = d.content as unknown as { id: string; title: string; source: { name: string; type: string } };
          return {
            id: d.id,
            text: d.text,
            note: d.note,
            created_at: d.created_at,
            content: {
              id: content.id,
              title: content.title,
              source: content.source,
            },
          };
        }) as HighlightWithContent[];
    },
    enabled: !!user,
  });
}
