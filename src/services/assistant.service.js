import { ConversationMessage } from "../models/ConversationMessage.js";
import { Task } from "../models/Task.js";
import { User } from "../models/User.js";
import { HttpError } from "../utils/httpError.js";
import { getKotibaReply } from "./gemini.service.js";
import { buildSmartSuggestions } from "./suggestion.service.js";
import { createAssistantTasks } from "./task.service.js";
import { synthesizeUzbekSpeech } from "./tts.service.js";
import { createConversationMessages } from "./conversation.service.js";

const getAssistantContext = async (userId) => {
  const [user, openTasks, recentMessages] = await Promise.all([
    User.findById(userId).lean(),
    Task.find({ user: userId, isCompleted: false }).sort({ createdAt: -1 }).limit(12).lean(),
    ConversationMessage.find({ user: userId }).sort({ createdAt: -1 }).limit(8).lean()
  ]);

  return {
    userProfile: user,
    openTasks,
    recentMessages: recentMessages.reverse()
  };
};

export const generateAssistantReply = async ({ userId, userText, includeAudio = true, interactionType = "text" }) => {
  const normalizedText = userText?.trim();

  if (!normalizedText) {
    throw new HttpError(400, "Matn yuborilmadi");
  }

  const assistantContext = await getAssistantContext(userId);
  const assistantPayload = await getKotibaReply(normalizedText, assistantContext);
  const createdTasks = await createAssistantTasks({
    userId,
    intent: assistantPayload.intent,
    tasks: assistantPayload.tasks
  });
  const aiText = assistantPayload.assistant_reply;
  const suggestionSeed = [
    normalizedText,
    aiText,
    ...createdTasks.map((task) => task.title)
  ].join(" ");
  const suggestions = buildSmartSuggestions(suggestionSeed);

  const savedMessages = await createConversationMessages({
    userId,
    interactionType,
    userText: normalizedText,
    assistantText: aiText,
    intent: assistantPayload.intent,
    createdTasks
  });

  if (!includeAudio) {
    return {
      userText: normalizedText,
      aiText,
      intent: assistantPayload.intent,
      tasks: assistantPayload.tasks,
      createdTasks,
      suggestions,
      savedMessages
    };
  }

  const tts = await synthesizeUzbekSpeech(aiText);

  return {
    userText: normalizedText,
    aiText,
    intent: assistantPayload.intent,
    tasks: assistantPayload.tasks,
    createdTasks,
    audioBase64: tts.audioBase64,
    audioMimeType: tts.mimeType,
    suggestions,
    savedMessages
  };
};
