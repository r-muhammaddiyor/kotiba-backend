import { ConversationMessage } from "../models/ConversationMessage.js";
import { Note } from "../models/Note.js";
import { Task } from "../models/Task.js";
import { User } from "../models/User.js";
import { HttpError } from "../utils/httpError.js";
import { getKotibaReply } from "./gemini.service.js";
import { buildSmartSuggestions } from "./suggestion.service.js";
import { createAssistantTasks } from "./task.service.js";
import { synthesizeUzbekSpeech } from "./tts.service.js";
import { createConversationMessages } from "./conversation.service.js";
import { createAssistantExpenses, getExpenseSummary } from "./expense.service.js";
import { createAssistantNotes } from "./note.service.js";

const getAssistantContext = async (userId) => {
  const [user, openTasks, recentMessages, recentNotes, financeSummary] = await Promise.all([
    User.findById(userId).lean(),
    Task.find({ user: userId, isCompleted: false }).sort({ createdAt: -1 }).limit(12).lean(),
    ConversationMessage.find({ user: userId }).sort({ createdAt: -1 }).limit(8).lean(),
    Note.find({ user: userId }).sort({ createdAt: -1 }).limit(6).lean(),
    getExpenseSummary(userId)
  ]);

  return {
    userProfile: user,
    openTasks,
    recentMessages: recentMessages.reverse(),
    recentNotes: recentNotes.reverse(),
    financeSummary
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
  const createdExpenses = await createAssistantExpenses(userId, assistantPayload.expenses);
  const createdNotes = await createAssistantNotes(userId, assistantPayload.notes);

  if (assistantPayload.finance_profile) {
    const monthlyIncome = Number(assistantPayload.finance_profile.monthly_income || 0);
    const monthlyLimit = Number(assistantPayload.finance_profile.monthly_limit || 0);

    if (monthlyIncome > 0 || monthlyLimit > 0) {
      await User.findByIdAndUpdate(userId, {
        $set: {
          "finance.monthlyIncome": monthlyIncome > 0 ? monthlyIncome : assistantContext.userProfile?.finance?.monthlyIncome || 0,
          "finance.monthlyLimit": monthlyLimit > 0 ? monthlyLimit : assistantContext.userProfile?.finance?.monthlyLimit || 0
        }
      });
    }
  }

  const aiText = assistantPayload.assistant_reply;
  const suggestionSeed = [
    normalizedText,
    aiText,
    ...createdTasks.map((task) => task.title),
    ...createdExpenses.map((expense) => expense.title),
    ...createdNotes.map((note) => note.title)
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
      expenses: assistantPayload.expenses,
      notes: assistantPayload.notes,
      financeProfile: assistantPayload.finance_profile,
      createdTasks,
      createdExpenses,
      createdNotes,
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
    expenses: assistantPayload.expenses,
    notes: assistantPayload.notes,
    financeProfile: assistantPayload.finance_profile,
    createdTasks,
    createdExpenses,
    createdNotes,
    audioBase64: tts.audioBase64,
    audioMimeType: tts.mimeType,
    suggestions,
    savedMessages
  };
};
