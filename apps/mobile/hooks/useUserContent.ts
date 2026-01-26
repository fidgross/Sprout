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
