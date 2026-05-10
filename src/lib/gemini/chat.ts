import { GoogleGenerativeAI } from "@google/generative-ai";

export function getChatModelName(): string {
  return process.env.GEMINI_CHAT_MODEL ?? "gemini-2.5-flash";
}

export async function generateChatReply(input: {
  systemInstruction: string;
  userMessage: string;
}): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: getChatModelName(),
    systemInstruction: input.systemInstruction,
  });

  const result = await model.generateContent(input.userMessage);
  const text = result.response.text();
  return text.trim();
}
