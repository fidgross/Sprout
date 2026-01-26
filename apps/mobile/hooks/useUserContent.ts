import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { ContentStatus } from '@curator/shared';

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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['saved'] });
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['history'] });
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
      return data.map(d => d.content);
    },
    enabled: !!user,
  });
}
