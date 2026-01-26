import { schedules } from "@trigger.dev/sdk/v3";
import {
  detectThemesForTopic,
  storeTheme,
  getAllTopics,
  cleanupExpiredThemes,
} from "../lib/themes";

/**
 * Scheduled job to detect trending themes across topics.
 * Runs weekly on Sundays at midnight UTC.
 *
 * For each topic:
 * 1. Fetches content from the past 7 days with embeddings
 * 2. Clusters content by embedding similarity
 * 3. Identifies themes where 3+ sources cover the same topic
 * 4. Stores detected themes with a 7-day expiration
 */
export const detectThemes = schedules.task({
  id: "detect-weekly-themes",
  cron: "0 0 * * 0", // Every Sunday at midnight UTC
  run: async () => {
    console.log("Starting theme detection job");

    // First, clean up expired themes
    const expiredCount = await cleanupExpiredThemes();
    console.log(`Cleaned up ${expiredCount} expired themes`);

    // Get all topics
    const topics = await getAllTopics();
    console.log(`Processing ${topics.length} topics`);

    let totalThemesCreated = 0;
    let topicsProcessed = 0;
    let topicsWithThemes = 0;
    let failed = 0;

    for (const topic of topics) {
      try {
        console.log(`Processing topic: ${topic.name} (${topic.id})`);

        // Detect themes for this topic
        const themeCandidates = await detectThemesForTopic(topic.id, topic.name);

        if (themeCandidates.length === 0) {
          console.log(`No themes detected for topic: ${topic.name}`);
          topicsProcessed++;
          continue;
        }

        console.log(
          `Found ${themeCandidates.length} theme candidates for topic: ${topic.name}`
        );

        // Store each theme
        for (const theme of themeCandidates) {
          const themeId = await storeTheme(
            topic.id,
            theme.title,
            theme.contentIds
          );

          console.log(
            `Created theme "${theme.title}" (${themeId}) with ${theme.contentIds.length} content items from ${theme.sourceCount} sources`
          );

          totalThemesCreated++;
        }

        topicsWithThemes++;
        topicsProcessed++;
      } catch (error) {
        console.error(`Failed to process topic ${topic.name}:`, error);
        failed++;
      }
    }

    const result = {
      topicsProcessed,
      topicsWithThemes,
      totalThemesCreated,
      expiredThemesRemoved: expiredCount,
      failed,
    };

    console.log("Theme detection job completed:", result);
    return result;
  },
});
