import { schedules } from "@trigger.dev/sdk/v3";
import {
  generateUserDigest,
  getCurrentUTCHour,
  getUsersForDigestHour,
  hasDigestForToday,
  storeDigest,
} from "../lib/digest";

/**
 * Scheduled job to generate and send daily digests.
 * Runs every hour at minute 0.
 * Processes users whose preferred digest_time hour matches the current UTC hour.
 */
export const sendDigests = schedules.task({
  id: "send-daily-digests",
  cron: "0 * * * *", // Every hour at minute 0
  run: async () => {
    const currentHour = getCurrentUTCHour();
    console.log(`Running digest job for UTC hour ${currentHour}`);

    // Get users whose digest_time matches the current hour
    const users = await getUsersForDigestHour(currentHour);
    console.log(`Found ${users.length} users for hour ${currentHour}`);

    let generated = 0;
    let skipped = 0;
    let failed = 0;

    for (const user of users) {
      try {
        // Check if user already has a digest for today
        const alreadyHasDigest = await hasDigestForToday(user.id);

        if (alreadyHasDigest) {
          console.log(`User ${user.id} already has a digest for today, skipping`);
          skipped++;
          continue;
        }

        // Generate digest content
        const contentIds = await generateUserDigest(user.id);

        if (contentIds.length === 0) {
          console.log(`No content for user ${user.id}'s digest, skipping`);
          skipped++;
          continue;
        }

        // Store the digest
        const digestId = await storeDigest(user.id, contentIds);
        console.log(
          `Created digest ${digestId} for user ${user.id} with ${contentIds.length} items`
        );

        generated++;
      } catch (error) {
        console.error(`Failed to generate digest for user ${user.id}:`, error);
        failed++;
      }
    }

    const result = {
      hour: currentHour,
      usersProcessed: users.length,
      digestsGenerated: generated,
      skipped,
      failed,
    };

    console.log("Digest job completed:", result);
    return result;
  },
});
