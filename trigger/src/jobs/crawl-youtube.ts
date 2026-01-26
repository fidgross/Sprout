import { task, schedules } from "@trigger.dev/sdk/v3";
import { supabase } from "../lib/supabase";
import {
  extractChannelId,
  getChannelVideos,
  getVideoTranscript,
  buildVideoUrl,
} from "../lib/youtube";
import { summarizeContent } from "./summarize-content";

// Scheduled job to crawl all YouTube sources every 6 hours
export const crawlAllYouTubeSources = schedules.task({
  id: "crawl-all-youtube-sources",
  cron: "0 */6 * * *", // Every 6 hours
  run: async () => {
    // Get all YouTube sources
    const { data: sources, error } = await supabase
      .from("sources")
      .select("*")
      .eq("type", "youtube");

    if (error) {
      console.error("Failed to fetch YouTube sources:", error);
      throw error;
    }

    console.log(`Found ${sources.length} YouTube sources to crawl`);

    // Crawl each source
    for (const source of sources) {
      await crawlYouTubeChannel.trigger({ sourceId: source.id });
    }

    return { sourcesQueued: sources.length };
  },
});

// Task to crawl a single YouTube channel
export const crawlYouTubeChannel = task({
  id: "crawl-youtube-channel",
  retry: {
    maxAttempts: 3,
  },
  run: async ({ sourceId }: { sourceId: string }) => {
    // Get source details
    const { data: source, error: sourceError } = await supabase
      .from("sources")
      .select("*")
      .eq("id", sourceId)
      .single();

    if (sourceError || !source) {
      console.error("Source not found:", sourceId);
      throw new Error(`Source not found: ${sourceId}`);
    }

    if (source.type !== "youtube") {
      console.log("Source is not YouTube:", source.name);
      return { skipped: true, reason: "not_youtube" };
    }

    console.log(`Crawling YouTube channel: ${source.name}`);

    // Extract channel ID from source URL
    const channelId = await extractChannelId(source.url);

    if (!channelId) {
      console.error("Could not extract channel ID from URL:", source.url);
      throw new Error(`Invalid YouTube URL: ${source.url}`);
    }

    // Determine the "since" date (last crawl or 7 days ago for new sources)
    const since = source.last_crawled_at
      ? new Date(source.last_crawled_at)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Fetch recent videos
    const videos = await getChannelVideos(channelId, since);
    console.log(`Found ${videos.length} videos since ${since.toISOString()}`);

    let newVideos = 0;
    const contentIds: string[] = [];

    for (const video of videos) {
      const videoUrl = buildVideoUrl(video.videoId);

      // Check if content already exists
      const { data: existing } = await supabase
        .from("content")
        .select("id")
        .eq("url", videoUrl)
        .single();

      if (existing) {
        continue; // Skip existing content
      }

      // Get transcript (may be null if unavailable)
      const transcript = await getVideoTranscript(video.videoId);

      // Insert new content
      const { data: inserted, error: insertError } = await supabase
        .from("content")
        .insert({
          source_id: source.id,
          title: video.title,
          url: videoUrl,
          published_at: new Date(video.publishedAt).toISOString(),
          content_type: "video",
          raw_text: transcript,
          duration_seconds: video.durationSeconds,
          audio_url: null, // Videos play directly from YouTube
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("Failed to insert content:", insertError);
        continue;
      }

      newVideos++;

      // Only queue for summarization if we have a transcript
      if (transcript && inserted) {
        contentIds.push(inserted.id);
      }
    }

    // Update last_crawled_at
    await supabase
      .from("sources")
      .update({ last_crawled_at: new Date().toISOString() })
      .eq("id", sourceId);

    // Trigger summarization for new content with transcripts
    for (const contentId of contentIds) {
      await summarizeContent.trigger({ contentId });
    }

    console.log(
      `Added ${newVideos} new videos from ${source.name}, ${contentIds.length} queued for summarization`
    );

    return {
      source: source.name,
      newVideos,
      summarizationQueued: contentIds.length,
    };
  },
});
