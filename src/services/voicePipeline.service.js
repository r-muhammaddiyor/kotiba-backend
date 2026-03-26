import { transcribeUzbekAudio } from "./stt.service.js";
import { generateAssistantReply } from "./assistant.service.js";

export const processVoicePipeline = async ({ userId, buffer, filename, mimeType }) => {
  const userText = await transcribeUzbekAudio(buffer, filename, mimeType);
  return generateAssistantReply({
    userId,
    userText,
    includeAudio: true,
    interactionType: "voice"
  });
};
