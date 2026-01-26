import { supabase } from "./supabase";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface ContentWithEmbedding {
  id: string;
  title: string;
  source_id: string;
  published_at: string;
  embedding: number[];
}

interface ContentCluster {
  contentIds: string[];
  sourceIds: Set<string>;
  titles: string[];
}

interface ThemeCandidate {
  title: string;
  contentIds: string[];
  sourceCount: number;
}

/**
 * Calculate cosine similarity between two embeddings
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
}

/**
 * Generate a theme title using Claude based on content titles.
 * Returns a title in the format "Trending in [Topic]: [subtitle]"
 */
async function generateThemeTitle(
  titles: string[],
  topicName: string
): Promise<string> {
  const prompt = `Based on these article/content titles that are trending together in the "${topicName}" topic, generate a short, engaging subtitle (max 40 characters) that captures the specific trend. Just return the subtitle, nothing else. Do not include "Trending in" or the topic name - just the subtitle.

Titles:
${titles.slice(0, 10).map((t) => `- ${t}`).join("\n")}

Subtitle:`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 100,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const subtitle =
      response.content[0].type === "text" ? response.content[0].text.trim() : "";

    if (subtitle) {
      return `Trending in ${topicName}: ${subtitle}`.slice(0, 100);
    }
    return `Trending in ${topicName}`;
  } catch (error) {
    console.error("Failed to generate theme title:", error);
    // Fallback to the standard format
    return `Trending in ${topicName}`;
  }
}

/**
 * Detect emerging themes for a specific topic.
 * Uses embedding similarity to cluster content and identifies themes
 * where 3+ sources cover the same topic.
 */
export async function detectThemesForTopic(
  topicId: string,
  topicName: string
): Promise<ThemeCandidate[]> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Get sources for this topic
  const { data: sourceMappings, error: sourceError } = await supabase
    .from("source_topics")
    .select("source_id")
    .eq("topic_id", topicId);

  if (sourceError) {
    console.error("Failed to fetch source topics:", sourceError);
    throw sourceError;
  }

  if (!sourceMappings || sourceMappings.length === 0) {
    console.log(`No sources for topic ${topicId}`);
    return [];
  }

  const sourceIds = sourceMappings.map((sm) => sm.source_id);

  // Get content from past 7 days with embeddings
  const { data: content, error: contentError } = await supabase
    .from("content")
    .select("id, title, source_id, published_at, embedding")
    .in("source_id", sourceIds)
    .gte("published_at", sevenDaysAgo.toISOString())
    .not("embedding", "is", null)
    .order("published_at", { ascending: false });

  if (contentError) {
    console.error("Failed to fetch content:", contentError);
    throw contentError;
  }

  if (!content || content.length < 3) {
    console.log(
      `Not enough content for topic ${topicId}: ${content?.length || 0} items`
    );
    return [];
  }

  // Type assertion for content with embeddings
  const contentWithEmbeddings = content as ContentWithEmbedding[];

  // Find clusters using embedding similarity
  const clusters = clusterContentBySimilarity(contentWithEmbeddings, 0.8);

  // Filter to clusters with 3+ different sources
  const validClusters = clusters.filter((cluster) => cluster.sourceIds.size >= 3);

  if (validClusters.length === 0) {
    console.log(`No valid clusters found for topic ${topicId}`);
    return [];
  }

  // Generate theme titles for valid clusters
  const themeCandidates: ThemeCandidate[] = [];

  for (const cluster of validClusters.slice(0, 5)) {
    // Limit to top 5 themes
    const title = await generateThemeTitle(cluster.titles, topicName);

    themeCandidates.push({
      title,
      contentIds: cluster.contentIds,
      sourceCount: cluster.sourceIds.size,
    });
  }

  return themeCandidates;
}

/**
 * Cluster content by embedding similarity.
 * Simple greedy algorithm: for each content item, find others with similarity > threshold
 */
function clusterContentBySimilarity(
  content: ContentWithEmbedding[],
  threshold: number
): ContentCluster[] {
  const clusters: ContentCluster[] = [];
  const assigned = new Set<string>();

  for (const item of content) {
    if (assigned.has(item.id)) continue;

    const cluster: ContentCluster = {
      contentIds: [item.id],
      sourceIds: new Set([item.source_id]),
      titles: [item.title],
    };
    assigned.add(item.id);

    // Find similar content
    for (const other of content) {
      if (assigned.has(other.id)) continue;

      const similarity = cosineSimilarity(item.embedding, other.embedding);

      if (similarity >= threshold) {
        cluster.contentIds.push(other.id);
        cluster.sourceIds.add(other.source_id);
        cluster.titles.push(other.title);
        assigned.add(other.id);
      }
    }

    // Only keep clusters with multiple items
    if (cluster.contentIds.length > 1) {
      clusters.push(cluster);
    }
  }

  // Sort clusters by number of sources (descending)
  clusters.sort((a, b) => b.sourceIds.size - a.sourceIds.size);

  return clusters;
}

/**
 * Store a detected theme in the database
 */
export async function storeTheme(
  topicId: string,
  title: string,
  contentIds: string[]
): Promise<string> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // Theme expires after 7 days

  const { data, error } = await supabase
    .from("themes")
    .insert({
      topic_id: topicId,
      title,
      content_ids: contentIds,
      expires_at: expiresAt.toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to store theme:", error);
    throw error;
  }

  return data.id;
}

/**
 * Get all topics for theme detection
 */
export async function getAllTopics(): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase
    .from("topics")
    .select("id, name")
    .eq("is_system", true);

  if (error) {
    console.error("Failed to fetch topics:", error);
    throw error;
  }

  return data || [];
}

/**
 * Clean up expired themes
 */
export async function cleanupExpiredThemes(): Promise<number> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("themes")
    .delete()
    .lt("expires_at", now)
    .select("id");

  if (error) {
    console.error("Failed to cleanup expired themes:", error);
    throw error;
  }

  return data?.length || 0;
}
