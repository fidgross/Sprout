import { supabase } from "./supabase";

interface ContentScore {
  id: string;
  sourceId: string;
  qualityScore: number;
  publishedAt: string;
  score: number;
}

/**
 * Generate a personalized digest for a user.
 * Returns the top 5-10 content IDs from the past 24 hours
 * matching the user's followed topics.
 */
export async function generateUserDigest(userId: string): Promise<string[]> {
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Get user's followed topic IDs
  const { data: userTopics, error: topicsError } = await supabase
    .from("user_topics")
    .select("topic_id")
    .eq("user_id", userId);

  if (topicsError) {
    console.error("Failed to fetch user topics:", topicsError);
    throw topicsError;
  }

  if (!userTopics || userTopics.length === 0) {
    console.log(`User ${userId} has no followed topics, skipping digest`);
    return [];
  }

  const topicIds = userTopics.map((ut) => ut.topic_id);

  // Get sources that match user's topics via source_topics join
  const { data: sourceMappings, error: sourceError } = await supabase
    .from("source_topics")
    .select("source_id")
    .in("topic_id", topicIds);

  if (sourceError) {
    console.error("Failed to fetch source topics:", sourceError);
    throw sourceError;
  }

  if (!sourceMappings || sourceMappings.length === 0) {
    console.log(`No sources match user ${userId}'s topics`);
    return [];
  }

  const sourceIds = [...new Set(sourceMappings.map((sm) => sm.source_id))];

  // Get content from the past 24 hours from those sources
  const { data: content, error: contentError } = await supabase
    .from("content")
    .select(
      `
      id,
      source_id,
      published_at,
      source:sources(quality_score)
    `
    )
    .in("source_id", sourceIds)
    .gte("published_at", twentyFourHoursAgo.toISOString())
    .order("published_at", { ascending: false });

  if (contentError) {
    console.error("Failed to fetch content:", contentError);
    throw contentError;
  }

  if (!content || content.length === 0) {
    console.log(`No recent content for user ${userId}`);
    return [];
  }

  // Score each piece of content
  const scoredContent: ContentScore[] = content.map((item) => {
    const source = item.source as unknown as { quality_score: number } | null;
    const qualityScore = source?.quality_score ?? 50;

    // Calculate recency boost: +20 for items within 24h
    // (All items here are within 24h, so all get the boost)
    const recencyBoost = 20;

    // Total score = quality_score + recency_boost
    const score = qualityScore + recencyBoost;

    return {
      id: item.id,
      sourceId: item.source_id,
      qualityScore,
      publishedAt: item.published_at,
      score,
    };
  });

  // Sort by score (descending)
  scoredContent.sort((a, b) => b.score - a.score);

  // Apply diversity constraint: max 2 items per source
  const selectedContent: ContentScore[] = [];
  const sourceCount: Record<string, number> = {};

  for (const item of scoredContent) {
    const currentCount = sourceCount[item.sourceId] || 0;

    if (currentCount < 2) {
      selectedContent.push(item);
      sourceCount[item.sourceId] = currentCount + 1;
    }

    // Stop when we have 10 items
    if (selectedContent.length >= 10) {
      break;
    }
  }

  // Ensure we have at least 5 items if available
  // If we have fewer than 5 after diversity filter, that's ok - return what we have
  const contentIds = selectedContent.map((item) => item.id);

  console.log(
    `Generated digest for user ${userId}: ${contentIds.length} items`
  );

  return contentIds;
}

/**
 * Get the current UTC hour (0-23)
 */
export function getCurrentUTCHour(): number {
  return new Date().getUTCHours();
}

/**
 * Get today's date in YYYY-MM-DD format (UTC)
 */
export function getTodayDateUTC(): string {
  const now = new Date();
  return now.toISOString().split("T")[0];
}

/**
 * Check if a user already has a digest for today
 */
export async function hasDigestForToday(userId: string): Promise<boolean> {
  const today = getTodayDateUTC();

  const { data, error } = await supabase
    .from("digests")
    .select("id")
    .eq("user_id", userId)
    .eq("date", today)
    .maybeSingle();

  if (error) {
    console.error("Failed to check existing digest:", error);
    throw error;
  }

  return data !== null;
}

/**
 * Store a digest record in the database
 */
export async function storeDigest(
  userId: string,
  contentIds: string[]
): Promise<string> {
  const today = getTodayDateUTC();

  const { data, error } = await supabase
    .from("digests")
    .insert({
      user_id: userId,
      date: today,
      content_ids: contentIds,
      sent_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to store digest:", error);
    throw error;
  }

  return data.id;
}

/**
 * Get users whose digest_time hour matches the given UTC hour
 */
export async function getUsersForDigestHour(
  hour: number
): Promise<{ id: string; email: string }[]> {
  // Format hour as HH:00 for comparison
  const hourStr = hour.toString().padStart(2, "0");

  // Query users whose preferences.digest_time starts with the hour
  // e.g., if hour is 7, match "07:00", "07:15", "07:30", etc.
  const { data, error } = await supabase
    .from("users")
    .select("id, email, preferences")
    .eq("onboarding_completed", true);

  if (error) {
    console.error("Failed to fetch users:", error);
    throw error;
  }

  // Filter users whose digest_time hour matches
  return (data || []).filter((user) => {
    const preferences = user.preferences as { digest_time?: string } | null;
    const digestTime = preferences?.digest_time || "07:00";
    const userHour = digestTime.split(":")[0];
    return userHour === hourStr;
  }).map((user) => ({ id: user.id, email: user.email }));
}
