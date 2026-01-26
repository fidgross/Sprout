import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { Topic } from '@curator/shared';

export function useUserTopics() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['userTopics', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('user_topics')
        .select(`
          topic_id,
          weight,
          topic:topics(*)
        `)
        .eq('user_id', user.id);

      if (error) throw error;
      return data.map(d => ({
        ...d.topic,
        weight: d.weight,
      })) as (Topic & { weight: number })[];
    },
    enabled: !!user,
  });
}

export function useToggleTopic() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ topicId, isFollowing }: { topicId: string; isFollowing: boolean }) => {
      if (!user) throw new Error('Not authenticated');

      if (isFollowing) {
        // Unfollow
        const { error } = await supabase
          .from('user_topics')
          .delete()
          .eq('user_id', user.id)
          .eq('topic_id', topicId);

        if (error) throw error;
      } else {
        // Follow
        const { error } = await supabase
          .from('user_topics')
          .insert({
            user_id: user.id,
            topic_id: topicId,
            weight: 1.0,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userTopics'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}

export function useSetUserTopics() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (topicIds: string[]) => {
      if (!user) throw new Error('Not authenticated');

      // Delete all existing topics
      await supabase
        .from('user_topics')
        .delete()
        .eq('user_id', user.id);

      // Insert new topics
      if (topicIds.length > 0) {
        const { error } = await supabase
          .from('user_topics')
          .insert(
            topicIds.map(topicId => ({
              user_id: user.id,
              topic_id: topicId,
              weight: 1.0,
            }))
          );

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userTopics'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}
