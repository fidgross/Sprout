import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateEmbedding(text: string): Promise<number[]> {
  // Limit text to ~8000 tokens (~32000 chars)
  const truncatedText = text.slice(0, 32000);

  try {
    const response = await openai.embeddings.create({
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
