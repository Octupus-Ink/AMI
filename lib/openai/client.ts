type OpenAIResult = {
  source: "openai" | "demo-fallback";
  content: string;
};

export function isOpenAIConfigured() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export async function generatePreparedInsight(prompt: string): Promise<OpenAIResult> {
  if (!isOpenAIConfigured()) {
    return {
      source: "demo-fallback",
      content: `Demo insight prepared without OpenAI: ${prompt.slice(0, 140)}`
    };
  }

  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: prompt
  });

  return {
    source: "openai",
    content: response.output_text
  };
}
