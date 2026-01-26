import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Content personalization scoring for feed ranking.
 *
 * Formula:
 *   final_score = base_score + topic_match + recency_boost
 *
 * Where:
 *   - base_score = source quality_score (0-100)
 *   - topic_match = weighted average of user's topic weights * content's topic relevance (0-50)
 *   - recency_boost = +20 for < 24h, +10 for < 7d, 0 otherwise
 */

interface PersonalizedFeedRequest {
  limit?: number;
  offset?: number;
  sourceType?: string;
  topicId?: string;
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

interface ScoredContent extends ContentWithSummary {
  personalization_score: number;
  score_breakdown: {
    base_score: number;
    topic_match: number;
    recency_boost: number;
  };
}

interface SourceTopic {
  source_id: string;
  topic_id: string;
  relevance: number;
}

interface UserTopic {
  topic_id: string;
  weight: number;
}

/**
 * Calculate recency boost based on published date.
 */
function calculateRecencyBoost(publishedAt: string): number {
  const published = new Date(publishedAt);
  const now = new Date();
  const hoursAgo = (now.getTime() - published.getTime()) / (1000 * 60 * 60);

  if (hoursAgo < 24) {
    return 20;
  } else if (hoursAgo < 24 * 7) {
    return 10;
  }
  return 0;
}

/**
 * Calculate topic match score.
 */
function calculateTopicMatch(
  sourceTopics: SourceTopic[],
  userTopics: UserTopic[]
): number {
  if (sourceTopics.length === 0 || userTopics.length === 0) {
    return 0;
  }

  const userWeightMap = new Map(
    userTopics.map((ut) => [ut.topic_id, ut.weight])
  );

  let totalWeight = 0;
  let weightedSum = 0;

  for (const st of sourceTopics) {
    const userWeight = userWeightMap.get(st.topic_id);
    if (userWeight !== undefined) {
      weightedSum += userWeight * st.relevance;
      totalWeight += st.relevance;
    }
  }

  if (totalWeight === 0) {
    return 0;
  }

  const avgMatch = weightedSum / totalWeight;
  return Math.min(50, avgMatch * 50);
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get authorization header to identify user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { limit = 20, offset = 0, sourceType, topicId }: PersonalizedFeedRequest =
      await req.json().catch(() => ({}));

    const cappedLimit = Math.min(limit, 100);

    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      console.error('Missing required environment variables');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use anon key with auth header to get user context
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get current user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role for data queries
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch more content than needed to allow for scoring and filtering
    const fetchLimit = cappedLimit * 3;

    // Build content query
    let contentQuery = supabase
      .from('content')
      .select(`
        *,
        source:sources(*),
        summary:summaries(*),
        user_content:user_content(*)
      `)
      .order('published_at', { ascending: false })
      .limit(fetchLimit);

    // Apply source type filter if provided
    if (sourceType) {
      contentQuery = contentQuery.eq('source.type', sourceType);
    }

    const { data: contents, error: contentError } = await contentQuery;

    if (contentError) {
      console.error('Content fetch error:', contentError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch content' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!contents || contents.length === 0) {
      return new Response(
        JSON.stringify({ items: [], hasMore: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get unique source IDs
    const sourceIds = [...new Set(contents.map((c: ContentWithSummary) => c.source_id))];

    // Fetch source topics
    let sourceTopicsQuery = supabase
      .from('source_topics')
      .select('source_id, topic_id, relevance')
      .in('source_id', sourceIds);

    // Filter by topic if provided
    if (topicId) {
      sourceTopicsQuery = sourceTopicsQuery.eq('topic_id', topicId);
    }

    const { data: sourceTopics } = await sourceTopicsQuery;

    // Group source topics by source_id
    const sourceTopicsMap = new Map<string, SourceTopic[]>();
    for (const st of (sourceTopics as SourceTopic[] | null) ?? []) {
      const existing = sourceTopicsMap.get(st.source_id) ?? [];
      existing.push(st);
      sourceTopicsMap.set(st.source_id, existing);
    }

    // Fetch user topics
    const { data: userTopics } = await supabase
      .from('user_topics')
      .select('topic_id, weight')
      .eq('user_id', user.id);

    const userTopicsList = (userTopics as UserTopic[] | null) ?? [];

    // If filtering by topic, only include content from sources with that topic
    let filteredContents = contents as ContentWithSummary[];
    if (topicId) {
      const sourcesWithTopic = new Set(
        (sourceTopics as SourceTopic[] | null)?.map((st) => st.source_id) ?? []
      );
      filteredContents = filteredContents.filter((c) => sourcesWithTopic.has(c.source_id));
    }

    // Filter out dismissed content
    filteredContents = filteredContents.filter((c) => {
      const userContent = Array.isArray(c.user_content) ? c.user_content[0] : c.user_content;
      return !userContent || (userContent as { status?: string }).status !== 'dismissed';
    });

    // Calculate scores for all content
    const scoredContents: ScoredContent[] = filteredContents.map((content) => {
      const source = content.source as { quality_score?: number } | null;
      const baseScore = source?.quality_score ?? 50;
      const contentSourceTopics = sourceTopicsMap.get(content.source_id) ?? [];
      const topicMatch = calculateTopicMatch(contentSourceTopics, userTopicsList);
      const recencyBoost = calculateRecencyBoost(content.published_at);

      return {
        ...content,
        personalization_score: baseScore + topicMatch + recencyBoost,
        score_breakdown: {
          base_score: baseScore,
          topic_match: topicMatch,
          recency_boost: recencyBoost,
        },
      };
    });

    // Sort by personalization score (descending)
    scoredContents.sort((a, b) => b.personalization_score - a.personalization_score);

    // Apply pagination
    const paginatedContents = scoredContents.slice(offset, offset + cappedLimit);
    const hasMore = scoredContents.length > offset + cappedLimit;

    return new Response(
      JSON.stringify({
        items: paginatedContents,
        hasMore,
        total: scoredContents.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Personalized feed error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
