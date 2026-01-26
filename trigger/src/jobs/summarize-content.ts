import { task } from "@trigger.dev/sdk/v3";
import { supabase } from "../lib/supabase";
import { generateSummary } from "../lib/claude";
import { generateEmbedding } from "../lib/openai";

// Task to summarize a single piece of content
export const summarizeContent = task({
  id: "summarize-content",
  retry: {
    maxAttempts: 3,
  },
  run: async ({ contentId }: { contentId: string }) => {
    // Get content with source
    const { data: content, error: contentError } = await supabase
      .from("content")
      .select("*, source:sources(*)")
      .eq("id", contentId)
      .single();

    if (contentError || !content) {
      throw new Error(`Content not found: ${contentId}`);
    }

    // Check if already summarized
    const { data: existingSummary } = await supabase
      .from("summaries")
      .select("id")
      .eq("content_id", contentId)
      .single();

    if (existingSummary) {
      console.log("Content already summarized:", contentId);
      return { skipped: true };
    }

    // Need text content to summarize
    if (!content.raw_text) {
      console.log("No raw text for content:", contentId);
      return { skipped: true, reason: "no_text" };
    }

    console.log(`Summarizing: ${content.title}`);

    // Generate summary with Claude
    const summary = await generateSummary(
      content.title,
      content.raw_text,
      content.content_type,
      content.source.name
    );

    // Insert summary
    const { error: summaryError } = await supabase.from("summaries").insert({
      content_id: contentId,
      headline: summary.headline,
      takeaways: summary.takeaways,
      deep_summary: summary.deep_summary,
      quotes: summary.quotes,
    });

    if (summaryError) {
      throw new Error(`Failed to insert summary: ${summaryError.message}`);
    }

    // Generate embedding
    const textForEmbedding = `${content.title}\n\n${summary.headline}\n\n${summary.takeaways.join("\n")}\n\n${content.raw_text}`;
    const embedding = await generateEmbedding(textForEmbedding);

    // Update content with embedding
    const { error: embeddingError } = await supabase
      .from("content")
      .update({ embedding })
      .eq("id", contentId);

    if (embeddingError) {
      console.error("Failed to store embedding:", embeddingError);
      // Don't throw - summary was saved successfully
    }

    console.log(`Summarized: ${content.title}`);

    return {
      contentId,
      headline: summary.headline,
      takeawaysCount: summary.takeaways.length,
    };
  },
});

// Task to process all unsummarized content
export const summarizeAllPending = task({
  id: "summarize-all-pending",
  run: async () => {
    // Get content without summaries
    const { data: pendingContent, error } = await supabase
      .from("content")
      .select("id")
      .is("embedding", null) // No embedding means not processed
      .not("raw_text", "is", null) // Has text to summarize
      .order("published_at", { ascending: false })
      .limit(50); // Process in batches

    if (error) {
      throw error;
    }

    console.log(`Found ${pendingContent.length} items to summarize`);

    for (const content of pendingContent) {
      await summarizeContent.trigger({ contentId: content.id });
    }

    return { queued: pendingContent.length };
  },
});
