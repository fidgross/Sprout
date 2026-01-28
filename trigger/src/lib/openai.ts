import OpenAI from "openai";

// Lazy initialization to avoid failing at import time when API key is not set
let openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is required");
    }
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  // Limit text to ~8000 tokens (~32000 chars)
  const truncatedText = text.slice(0, 32000);

  try {
    const response = await getOpenAI().embeddings.create({
      model: "text-embedding-3-small",
      input: truncatedText,
    });

    if (!response.data || !response.data[0] || !response.data[0].embedding) {
      throw new Error("Invalid embedding response structure");
    }

    return response.data[0].embedding;
  } catch (error) {
    console.error("Failed to generate embedding:", error);
    throw error;
  }
}
