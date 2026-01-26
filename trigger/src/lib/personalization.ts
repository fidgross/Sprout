import { supabase } from './supabase';

/**
 * Topic weight management for batch processing jobs.
 *
 * NOTE: Personalization scoring (calculateRecencyBoost, calculateTopicMatch, etc.)
 * is handled by the edge function at supabase/functions/personalized-feed/index.ts.
 * This module only contains topic weight update logic for use in background jobs.
 */

/**
 * Update user topic weight based on interaction.
 *
 * Weight adjustments:
 * - Read full summary: +0.1
 * - Saved item: +0.2
 * - Dismissed: -0.1
 */
export type InteractionType = 'read' | 'save' | 'dismiss';

const WEIGHT_ADJUSTMENTS: Record<InteractionType, number> = {
  read: 0.1,
  save: 0.2,
  dismiss: -0.1,
};

// Minimum and maximum weight bounds
const MIN_WEIGHT = 0.1;
const MAX_WEIGHT = 5.0;

/**
 * Update topic weights for a user based on content interaction.
 * Adjusts weights for all topics associated with the content's source.
 */
export async function updateTopicWeightsForInteraction(
  userId: string,
  contentId: string,
  interaction: InteractionType
): Promise<void> {
  const adjustment = WEIGHT_ADJUSTMENTS[interaction];

  // Get content's source
  const { data: content } = await supabase
    .from('content')
    .select('source_id')
    .eq('id', contentId)
    .single();

  if (!content) {
    return;
  }

  // Get topics associated with this source
  const { data: sourceTopics } = await supabase
    .from('source_topics')
    .select('topic_id')
    .eq('source_id', content.source_id);

  if (!sourceTopics || sourceTopics.length === 0) {
    return;
  }

  const topicIds = sourceTopics.map((st: { topic_id: string }) => st.topic_id);

  // Get user's current topic weights for these topics
  const { data: existingUserTopics } = await supabase
    .from('user_topics')
    .select('topic_id, weight')
    .eq('user_id', userId)
    .in('topic_id', topicIds);

  const existingMap = new Map(
    (existingUserTopics as { topic_id: string; weight: number }[] | null)?.map((ut) => [
      ut.topic_id,
      ut.weight,
    ]) ?? []
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
