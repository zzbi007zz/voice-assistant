
import { GoogleGenAI, GenerateContentParameters, Content } from "@google/genai";
import { GEMINI_MODEL_FLASH, SYSTEM_INSTRUCTION_PROMPT } from '../constants';
import { AssistantApiResponse, GroundingChunk } from "../types";

const API_KEY = process.env.API_KEY;

let ai: GoogleGenAI | null = null;

if (API_KEY) {
  try {
    ai = new GoogleGenAI({ apiKey: API_KEY });
  } catch (error) {
    console.error("Failed to initialize GoogleGenAI:", error);
    // ai remains null, handled in getAssistantResponse
  }
} else {
  console.warn("API_KEY environment variable not found.");
}

export const getAssistantResponse = async (userQuery: string): Promise<AssistantApiResponse> => {
  if (!ai) {
    return { text: "Error: AI service is not initialized. Please ensure the API_KEY is correctly configured." };
  }
  if (!userQuery.trim()) {
    return { text: "I didn't receive any input. Please try speaking again." };
  }

  try {
    const contents: Content[] = [
      { role: "user", parts: [{ text: userQuery }] }
    ];

    const modelConfig: GenerateContentParameters['config'] = {
      systemInstruction: SYSTEM_INSTRUCTION_PROMPT,
      tools: [{ googleSearch: {} }], // Always provide the tool; system prompt guides usage.
      // Optional: Add thinkingConfig if needed, e.g. for low latency.
      // thinkingConfig: { thinkingBudget: 0 } 
    };

    const result = await ai.models.generateContent({
      model: GEMINI_MODEL_FLASH,
      contents: contents,
      config: modelConfig,
    });
    
    const responseText = result.text;
    const groundingMetadata = result.candidates?.[0]?.groundingMetadata;
    
    let references: GroundingChunk[] | undefined = undefined;
    if (groundingMetadata?.groundingChunks && groundingMetadata.groundingChunks.length > 0) {
        references = groundingMetadata.groundingChunks
            .map(chunk => ({
                web: {
                    uri: chunk.web?.uri || '',
                    title: chunk.web?.title || ''
                }
            }))
            .filter(ref => ref.web.uri) as GroundingChunk[];
        if (references.length === 0) references = undefined;
    }

    return { text: responseText, references };

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    let errorMessage = "Sorry, I encountered an error while processing your request.";
    if (error instanceof Error) {
      // It's better not to expose raw error messages to the user in production for security
      // but for debugging it can be useful.
      // errorMessage += ` Details: ${error.message}`; 
      if (error.message.includes("API_KEY_INVALID") || error.message.includes("API_KEY_MISSING")) {
        errorMessage = "There's an issue with the API key configuration."
      } else if (error.message.includes("Access to model")) {
         errorMessage = "Could not access the AI model. Please check model name and permissions."
      }
    }
    return { text: errorMessage };
  }
};
