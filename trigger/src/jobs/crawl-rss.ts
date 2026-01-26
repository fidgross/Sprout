import { task, schedules } from "@trigger.dev/sdk/v3";
import { supabase } from "../lib/supabase";
import { parseRSSFeed, parseDuration } from "../lib/rss";

// Scheduled job to crawl all RSS sources every hour
export const crawlAllRSSSources = schedules.task({
  id: "crawl-all-rss-sources",
  cron: "0 * * * *", // Every hour
  run: async () => {
    // Get all RSS-based sources (podcasts, newsletters, blogs)
    const { data: sources, error } = await supabase
      .from("sources")
      .select("*")
      .in("type", ["podcast", "newsletter", "blog"])
      .not("feed_url", "is", null);

    if (error) {
      console.error("Failed to fetch sources:", error);
      throw error;
    }

    console.log(`Found ${sources.length} RSS sources to crawl`);

    // Crawl each source
    for (const source of sources) {
      await crawlSingleSource.trigger({ sourceId: source.id });
    }

    return { sourcesQueued: sources.length };
  },
});

// Task to crawl a single source
export const crawlSingleSource = task({
  id: "crawl-single-source",
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

    if (!source.feed_url) {
      console.log("No feed URL for source:", source.name);
      return { skipped: true };
    }

    console.log(`Crawling ${source.name}: ${source.feed_url}`);

    // Parse RSS feed
    const items = await parseRSSFeed(source.feed_url);
    console.log(`Found ${items.length} items in feed`);

    let newItems = 0;

    for (const item of items) {
      // Check if content already exists
      const { data: existing } = await supabase
        .from("content")
        .select("id")
        .eq("url", item.link)
        .single();

      if (existing) {
        continue; // Skip existing content
      }

      // Determine content type based on source type
      const contentType = source.type === "podcast" ? "episode" : "article";

      // Insert new content
      const { error: insertError } = await supabase.from("content").insert({
        source_id: source.id,
        title: item.title,
        url: item.link,
        published_at: new Date(item.pubDate).toISOString(),
        content_type: contentType,
        raw_text: item.content,
        duration_seconds: parseDuration(item.duration),
        audio_url: item.audioUrl,
      });

      if (insertError) {
        console.error("Failed to insert content:", insertError);
        continue;
      }

      newItems++;
    }

    // Update last_crawled_at
    await supabase
      .from("sources")
      .update({ last_crawled_at: new Date().toISOString() })
      .eq("id", sourceId);

    console.log(`Added ${newItems} new items from ${source.name}`);

    return { source: source.name, newItems };
  },
});
