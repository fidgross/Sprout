import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { ContentWithSummary } from '@curator/shared';

// Types
export interface Collection {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  item_count?: number;
}

export interface CollectionItem {
  collection_id: string;
  content_id: string;
  added_at: string;
  content: ContentWithSummary;
}

// Fetch all collections for the current user with item counts
export function useCollections() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['collections', user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Fetch collections
      const { data: collections, error: collectionsError } = await supabase
        .from('collections')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (collectionsError) throw collectionsError;

      // Fetch item counts for each collection
      const collectionsWithCounts = await Promise.all(
        collections.map(async (collection) => {
          const { count, error: countError } = await supabase
            .from('collection_items')
            .select('*', { count: 'exact', head: true })
            .eq('collection_id', collection.id);

          if (countError) {
            console.error('Error fetching count for collection:', collection.id, countError);
            return { ...collection, item_count: 0 };
          }

          return { ...collection, item_count: count ?? 0 };
        })
      );

      return collectionsWithCounts as Collection[];
    },
    enabled: !!user,
  });
}

// Fetch items in a specific collection
export function useCollectionItems(collectionId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['collection-items', collectionId],
    queryFn: async () => {
      if (!user || !collectionId) return [];

      const { data, error } = await supabase
        .from('collection_items')
        .select(`
          collection_id,
          content_id,
          added_at,
          content:content(
            *,
            source:sources(*),
            summary:summaries(*),
            user_content:user_content(*)
          )
        `)
        .eq('collection_id', collectionId)
        .order('added_at', { ascending: false });

      if (error) throw error;

      // Transform the data to match our interface
      return data
        .filter(d => d.content !== null)
        .map(d => ({
          collection_id: d.collection_id,
          content_id: d.content_id,
          added_at: d.added_at,
          content: d.content as unknown as ContentWithSummary,
        })) as CollectionItem[];
    },
    enabled: !!user && !!collectionId,
  });
}

// Fetch a single collection by ID
export function useCollectionById(collectionId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['collection', collectionId],
    queryFn: async () => {
      if (!user || !collectionId) return null;

      const { data, error } = await supabase
        .from('collections')
        .select('*')
        .eq('id', collectionId)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      return data as Collection;
    },
    enabled: !!user && !!collectionId,
  });
}

// Create a new collection
export function useCreateCollection() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ name, description }: { name: string; description?: string }) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('collections')
        .insert({
          user_id: user.id,
          name,
          description: description || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Collection;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });
}

// Delete a collection
export function useDeleteCollection() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (collectionId: string) => {
      if (!user) throw new Error('Not authenticated');

      // First delete all items in the collection
      const { error: itemsError } = await supabase
        .from('collection_items')
        .delete()
        .eq('collection_id', collectionId);

      if (itemsError) throw itemsError;

      // Then delete the collection itself
      const { error } = await supabase
        .from('collections')
        .delete()
        .eq('id', collectionId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });
}

// Add content to a collection
export function useAddToCollection() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ collectionId, contentId }: { collectionId: string; contentId: string }) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('collection_items')
        .insert({
          collection_id: collectionId,
          content_id: contentId,
          added_at: new Date().toISOString(),
        });

      if (error) throw error;
    },
    onSuccess: (_, { collectionId }) => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      queryClient.invalidateQueries({ queryKey: ['collection-items', collectionId] });
    },
  });
}

// Remove content from a collection
export function useRemoveFromCollection() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ collectionId, contentId }: { collectionId: string; contentId: string }) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('collection_items')
        .delete()
        .eq('collection_id', collectionId)
        .eq('content_id', contentId);

      if (error) throw error;
    },
    onSuccess: (_, { collectionId }) => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      queryClient.invalidateQueries({ queryKey: ['collection-items', collectionId] });
    },
  });
}

// Check if content is in any collections (useful for UI indicators)
export function useContentCollections(contentId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['content-collections', contentId],
    queryFn: async () => {
      if (!user || !contentId) return [];

      const { data, error } = await supabase
        .from('collection_items')
        .select(`
          collection_id,
          collection:collections(id, name)
        `)
        .eq('content_id', contentId);

      if (error) throw error;

      return data
        .filter(d => d.collection !== null)
        .map(d => ({
          id: (d.collection as any).id,
          name: (d.collection as any).name,
        })) as { id: string; name: string }[];
    },
    enabled: !!user && !!contentId,
  });
}
