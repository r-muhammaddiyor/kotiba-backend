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
import { createAssistantExpenses, getExpenseSnapshot } from "./expense.service.js";
import { createAssistantNotes } from "./note.service.js";

const buildIsoDateAfterMinutes = (minutesFromNow) => new Date(Date.now() + minutesFromNow * 60 * 1000).toISOString();

const absoluteTimeCuePattern =
  /\b(soat\s*\d{1,2}(:\d{2})?|\d{1,2}:\d{2}|bugun|ertaga|indin|dushanba|seshanba|chorshanba|payshanba|juma|shanba|yakshanba|ertalab|kechqurun|tushda)\b/i;

const inferRelativeMinutes = (text) => {
  const normalized = String(text || "").toLowerCase().trim();

  const minuteMatch = normalized.match(/(\d+)\s*(daqiqa|minut|min)\s*(dan\s*)?(keyin|so'ng|song)/);
  if (minuteMatch) {
    return Number(minuteMatch[1]);
  }

  const hourMatch = normalized.match(/(\d+)\s*soat\s*(dan\s*)?(keyin|so'ng|song)/);
  if (hourMatch) {
    return Number(hourMatch[1]) * 60;
  }

  const dayMatch = normalized.match(/(\d+)\s*kun\s*(dan\s*)?(keyin|so'ng|song)/);
  if (dayMatch) {
    return Number(dayMatch[1]) * 24 * 60;
  }

  return null;
};

const hydrateRelativeTasks = (payload, userText) => {
  const relativeMinutes = inferRelativeMinutes(userText);
  const hasAbsoluteTimeCue = absoluteTimeCuePattern.test(String(userText || ""));

  if (!relativeMinutes || !Array.isArray(payload?.tasks) || !payload.tasks.length) {
    return payload;
  }

  return {
    ...payload,
    tasks: payload.tasks.map((task) => {
      if (task.schedule_at && hasAbsoluteTimeCue) {
        return task;
      }

      return {
        ...task,
        schedule_at: buildIsoDateAfterMinutes(relativeMinutes),
        remind_before_minutes: 0
      };
    })
  };
};

const getAssistantContext = async (userId) => {
  const [user, openTasks, recentMessages, recentNotes, financeSummary] = await Promise.all([
    User.findById(userId)
      .select("name locale timeZone preferences finance")
      .lean(),
    Task.find({ user: userId, isCompleted: false })
      .select("title note description scheduleAt remindBeforeMinutes repeat locationLabel")
      .sort({ createdAt: -1 })
      .limit(6)
      .lean(),
    ConversationMessage.find({ user: userId })
      .select("role text interactionType")
      .sort({ createdAt: -1 })
      .limit(4)
      .lean(),
    Note.find({ user: userId })
      .select("title body")
      .sort({ createdAt: -1 })
      .limit(3)
      .lean(),
    getExpenseSnapshot(userId)
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
  const assistantPayload = hydrateRelativeTasks(await getKotibaReply(normalizedText, assistantContext), normalizedText);
  const [createdTasks, createdExpenses, createdNotes] = await Promise.all([
    createAssistantTasks({
      userId,
      intent: assistantPayload.intent,
      tasks: assistantPayload.tasks
    }),
    createAssistantExpenses(userId, assistantPayload.expenses),
    createAssistantNotes(userId, assistantPayload.notes)
  ]);

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
