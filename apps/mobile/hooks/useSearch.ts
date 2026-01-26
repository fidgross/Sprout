import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { ContentWithSummary } from '@curator/shared';

interface SearchResult {
  results: ContentWithSummary[];
  keywordResults: ContentWithSummary[];
  semanticResults: ContentWithSummary[];
}

interface UseSearchOptions {
  limit?: number;
  enabled?: boolean;
}

/**
 * Performs hybrid search combining keyword and semantic search.
 *
 * For MVP: keyword search only (runs directly against Supabase).
 * Full hybrid search requires the edge function for semantic search.
 */
export function useSearch(query: string, options: UseSearchOptions = {}) {
  const { limit = 20, enabled = true } = options;
  const trimmedQuery = query.trim();

  return useQuery({
    queryKey: ['search', trimmedQuery, limit],
    queryFn: async (): Promise<SearchResult> => {
      if (!trimmedQuery) {
        return { results: [], keywordResults: [], semanticResults: [] };
      }

      // Try hybrid search via edge function first
      try {
        const { data: hybridData, error: hybridError } = await supabase.functions.invoke('search', {
          body: { query: trimmedQuery, limit },
        });

        if (!hybridError && hybridData) {
          return {
            results: hybridData.results || [],
            keywordResults: hybridData.keywordResults || [],
            semanticResults: hybridData.semanticResults || [],
          };
        }
      } catch {
        // Edge function not available, fall back to keyword-only search
      }

      // Fallback: Keyword-only search directly via Supabase
      const keywordResults = await performKeywordSearch(trimmedQuery, limit);

      return {
        results: keywordResults,
        keywordResults,
        semanticResults: [],
      };
    },
    enabled: enabled && trimmedQuery.length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes (formerly cacheTime)
  });
}

/**
 * Performs keyword search using PostgreSQL full-text search.
 * Uses the pre-computed tsvector column on the content table.
 */
async function performKeywordSearch(
  query: string,
  limit: number
): Promise<ContentWithSummary[]> {
  // Convert query to tsquery format using plainto_tsquery
  // This handles multi-word queries by creating an AND query
  const { data, error } = await supabase
    .from('content')
    .select(`
      *,
      source:sources(*),
      summary:summaries(*),
      user_content:user_content(*)
    `)
    .textSearch('fts', query, {
      type: 'websearch',
      config: 'english',
    })
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Keyword search error:', error);
    throw error;
  }

  return (data as ContentWithSummary[]) || [];
}

/**
 * Hook for keyword-only search (simpler, no edge function required).
 */
export function useKeywordSearch(query: string, options: UseSearchOptions = {}) {
  const { limit = 20, enabled = true } = options;
  const trimmedQuery = query.trim();

  return useQuery({
    queryKey: ['keywordSearch', trimmedQuery, limit],
    queryFn: async () => {
      if (!trimmedQuery) {
        return [];
      }
      return performKeywordSearch(trimmedQuery, limit);
    },
    enabled: enabled && trimmedQuery.length > 0,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  });
}
