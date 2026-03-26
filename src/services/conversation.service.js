import { ConversationMessage } from "../models/ConversationMessage.js";
import { HttpError } from "../utils/httpError.js";

export const createConversationMessages = async ({ userId, interactionType, userText, assistantText, intent, createdTasks }) => {
  const messages = [];

  if (userText) {
    messages.push({
      user: userId,
      role: "user",
      text: userText,
      interactionType,
      transcriptHidden: interactionType === "voice"
    });
  }

  if (assistantText) {
    messages.push({
      user: userId,
      role: "assistant",
      text: assistantText,
      interactionType,
      intent: intent ?? null,
      taskCount: createdTasks?.length || 0,
      audioAvailable: interactionType === "voice"
    });
  }

  if (!messages.length) {
    return [];
  }

  return ConversationMessage.insertMany(messages);
};

export const listConversationMessages = async (userId, limit = 80) =>
  ConversationMessage.find({ user: userId })
    .sort({ createdAt: 1 })
    .limit(limit)
    .lean();

export const clearConversationHistory = async (userId) => {
  const result = await ConversationMessage.deleteMany({ user: userId });
  return {
    deletedCount: result.deletedCount || 0
  };
};

export const deleteConversationMessage = async (userId, messageId) => {
  const deleted = await ConversationMessage.findOneAndDelete({
    _id: messageId,
    user: userId
  });

  if (!deleted) {
    throw new HttpError(404, "Xabar topilmadi");
  }

  return {
    id: String(deleted._id)
  };
};
