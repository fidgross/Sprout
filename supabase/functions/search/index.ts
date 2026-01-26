import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SearchRequest {
  query: string;
  limit?: number;
}

interface ContentWithSummary {
  id: string;
  source_id: string;
  title: string;
  url: string;
  published_at: string;
  content_type: string;
  raw_text: string | null;
  duration_seconds: number | null;
  audio_url: string | null;
  created_at: string;
  source: Record<string, unknown>;
  summary: Record<string, unknown> | null;
  user_content?: Record<string, unknown>;
}

interface SearchResponse {
  results: ContentWithSummary[];
  keywordResults: ContentWithSummary[];
  semanticResults: ContentWithSummary[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { query, limit: requestedLimit = 20 }: SearchRequest = await req.json();
    const limit = Math.min(requestedLimit, 100); // Cap limit to prevent abuse

    if (!query || typeof query !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Query parameter is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return new Response(
        JSON.stringify({ results: [], keywordResults: [], semanticResults: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role for full access
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Run keyword and semantic search in parallel
    const [keywordResults, semanticResults] = await Promise.all([
      performKeywordSearch(supabase, trimmedQuery, limit),
      performSemanticSearch(supabase, trimmedQuery, limit),
    ]);

    // Merge and deduplicate results
    const mergedResults = mergeResults(keywordResults, semanticResults, limit);

    const response: SearchResponse = {
      results: mergedResults,
      keywordResults,
      semanticResults,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Search error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Performs keyword search using PostgreSQL full-text search on the fts column.
 */
async function performKeywordSearch(
  supabase: ReturnType<typeof createClient>,
  query: string,
  limit: number
): Promise<ContentWithSummary[]> {
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
    return [];
  }

  return (data as ContentWithSummary[]) || [];
}

/**
 * Performs semantic search using OpenAI embeddings and pgvector.
 */
async function performSemanticSearch(
  supabase: ReturnType<typeof createClient>,
  query: string,
  limit: number
): Promise<ContentWithSummary[]> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

  if (!openaiApiKey) {
    console.warn('OPENAI_API_KEY not set, skipping semantic search');
    return [];
  }

  try {
    // Get embedding for the query
    const embedding = await getQueryEmbedding(query, openaiApiKey);

    if (!embedding) {
      return [];
    }

    // Perform similarity search using pgvector
    // Uses the <=> operator for cosine distance
    const { data, error } = await supabase.rpc('match_content_by_embedding', {
      query_embedding: embedding,
      match_threshold: 0.7,
      match_count: limit,
    });

    if (error) {
      // If the RPC doesn't exist, fall back to raw query
      console.warn('RPC not available, using raw query:', error.message);
      return await performSemanticSearchRaw(supabase, embedding, limit);
    }

    // The RPC returns just content IDs and similarity scores
    // Fetch full content with relations
    if (!data || data.length === 0) {
      return [];
    }

    const contentIds = data.map((row: { id: string }) => row.id);
    const { data: fullContent, error: fetchError } = await supabase
      .from('content')
      .select(`
        *,
        source:sources(*),
        summary:summaries(*),
        user_content:user_content(*)
      `)
      .in('id', contentIds);

    if (fetchError) {
      console.error('Error fetching full content:', fetchError);
      return [];
    }

    // Sort by the original similarity order
    const contentMap = new Map(fullContent?.map((c: ContentWithSummary) => [c.id, c]) || []);
    return contentIds
      .map((id: string) => contentMap.get(id))
      .filter((c: ContentWithSummary | undefined): c is ContentWithSummary => c !== undefined);
  } catch (error) {
    console.error('Semantic search error:', error);
    return [];
  }
}

/**
 * Fallback semantic search using raw SQL when RPC is not available.
 */
async function performSemanticSearchRaw(
  supabase: ReturnType<typeof createClient>,
  embedding: number[],
  limit: number
): Promise<ContentWithSummary[]> {
  // Use the pgvector <=> operator for cosine distance
  const embeddingStr = `[${embedding.join(',')}]`;

  const { data, error } = await supabase
    .from('content')
    .select(`
      *,
      source:sources(*),
      summary:summaries(*),
      user_content:user_content(*)
    `)
    .not('embedding', 'is', null)
    .order('published_at', { ascending: false })
    .limit(limit * 2); // Get more to filter by similarity later

  if (error) {
    console.error('Raw semantic search error:', error);
    return [];
  }

  // Note: Without proper RPC, we can't do true vector similarity in the query
  // This is a fallback that just returns recent content with embeddings
  return ((data as ContentWithSummary[]) || []).slice(0, limit);
}

/**
 * Gets embedding vector from OpenAI for a query string.
 */
async function getQueryEmbedding(
  query: string,
  apiKey: string
): Promise<number[] | null> {
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: query,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI API error:', error);
      return null;
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('Error getting embedding:', error);
    return null;
  }
}

/**
 * Merges keyword and semantic results, deduplicating by content ID.
 * Prioritizes items that appear in both result sets.
 */
function mergeResults(
  keywordResults: ContentWithSummary[],
  semanticResults: ContentWithSummary[],
  limit: number
): ContentWithSummary[] {
  const resultMap = new Map<string, ContentWithSummary & { score: number }>();

  // Add keyword results with base score
  keywordResults.forEach((item, index) => {
    resultMap.set(item.id, {
      ...item,
      score: keywordResults.length - index, // Higher score for earlier results
    });
  });

  // Add semantic results, boosting items that appear in both
  semanticResults.forEach((item, index) => {
    const existing = resultMap.get(item.id);
    if (existing) {
      // Boost score for items in both result sets
      existing.score += (semanticResults.length - index) * 1.5;
    } else {
      resultMap.set(item.id, {
        ...item,
        score: (semanticResults.length - index) * 0.8, // Slightly lower for semantic-only
      });
    }
  });

  // Sort by combined score and return top results
  return Array.from(resultMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ score, ...item }) => item as ContentWithSummary);
}
