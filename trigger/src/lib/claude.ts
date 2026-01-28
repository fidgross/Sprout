import Anthropic from "@anthropic-ai/sdk";

// Lazy initialization to avoid failing at import time when API key is not set
let anthropic: Anthropic | null = null;

function getAnthropic(): Anthropic {
  if (!anthropic) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY environment variable is required");
    }
    anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropic;
}

export interface SummaryResult {
  headline: string;
  takeaways: string[];
  deep_summary: string;
  quotes: string[];
}

export async function generateSummary(
  title: string,
  content: string,
  contentType: string,
  sourceName: string
): Promise<SummaryResult> {
  const prompt = `You are summarizing content for busy professionals who want key insights fast.

Content Type: ${contentType}
Source: ${sourceName}
Title: ${title}

Content:
${content.slice(0, 100000)}

Generate a JSON response with:
- headline: One sentence capturing the core thesis (max 150 chars)
- takeaways: Array of 3-5 non-obvious, actionable insights
- deep_summary: 500-1000 word comprehensive summary
- quotes: Array of 2-3 memorable direct quotes from the content

Focus on:
- Non-obvious insights over common knowledge
- Actionable implications
- Preserving nuance and caveats

Respond with valid JSON only, no markdown code blocks.`;

  const response = await getAnthropic().messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  if (!text) {
    throw new Error("Empty response from Claude");
  }

  try {
    const result = JSON.parse(text);

    // Validate required fields
    if (!result.headline || !Array.isArray(result.takeaways) || !result.deep_summary || !Array.isArray(result.quotes)) {
      throw new Error("Missing required fields in Claude response");
    }

    return result as SummaryResult;
  } catch (e) {
    console.error("Failed to parse Claude response:", text.slice(0, 500));
    throw new Error("Invalid JSON response from Claude");
  }
}
