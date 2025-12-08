import { generateText } from 'ai';
import { resolveModel } from './model-resolver';

const GENERATE_TITLE_PROMPT = (
  userMessage: string,
) => `Based on the following user message, generate a concise, descriptive title for this conversation. The title should be:
- Maximum 60 characters
- Clear and specific to the user's intent
- Not include quotes or special formatting
- Be a noun phrase or short sentence

User message: "${userMessage}"

Generate only the title, nothing else:`;

export async function generateConversationTitle(
  userMessage: string,
): Promise<string> {
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error('Title generation timeout after 10 seconds')),
        10000,
      );
    });

    const generatePromise = generateText({
      model: await resolveModel('azure/gpt-5-mini'),
      prompt: GENERATE_TITLE_PROMPT(userMessage),
    });

    const result = await Promise.race([generatePromise, timeoutPromise]);
    const title = result.text.trim();

    const cleanTitle = title
      .replace(/^["']|["']$/g, '')
      .trim()
      .slice(0, 60);

    return cleanTitle || 'New Conversation';
  } catch (error) {
    console.error('[generateConversationTitle] Error:', error);
    return 'New Conversation';
  }
}
