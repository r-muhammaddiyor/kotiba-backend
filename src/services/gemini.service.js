import { env } from "../config/env.js";
import { HttpError } from "../utils/httpError.js";
import { buildKotibaMasterPrompt } from "./kotibaPrompt.service.js";

const allowedIntents = new Set(["chat", "reminder", "task", "mixed", "note"]);
const allowedRepeatTypes = new Set(["none", "hourly", "daily", "weekly", "custom"]);

const extractGeminiText = (payload) =>
  payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part?.text)
    .filter(Boolean)
    .join("")
    .trim() ?? "";

const extractOpenAiText = (payload) => {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  return (
    payload?.output
      ?.flatMap((item) => item?.content ?? [])
      ?.filter((item) => item?.type === "output_text" && item?.text)
      ?.map((item) => item.text)
      ?.join("")
      .trim() ?? ""
  );
};

const extractJsonObject = (rawText) => {
  const normalized = rawText.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "");

  try {
    return JSON.parse(normalized);
  } catch (directError) {
    const start = normalized.indexOf("{");
    const end = normalized.lastIndexOf("}");

    if (start === -1 || end === -1 || start >= end) {
      throw directError;
    }

    return JSON.parse(normalized.slice(start, end + 1));
  }
};

const normalizeTask = (task) => ({
  title: String(task?.title ?? "").trim(),
  note: String(task?.note ?? "").trim(),
  location_label: String(task?.location_label ?? task?.locationLabel ?? "").trim(),
  action_text: String(task?.action_text ?? "").trim(),
  schedule_at: task?.schedule_at ?? null,
  remind_before_minutes: Number.isFinite(Number(task?.remind_before_minutes))
    ? Math.max(0, Math.floor(Number(task.remind_before_minutes)))
    : 0,
  repeat: {
    type: allowedRepeatTypes.has(task?.repeat?.type) ? task.repeat.type : "none",
    interval_minutes:
      task?.repeat?.type === "custom" && Number.isFinite(Number(task?.repeat?.interval_minutes))
        ? Math.max(1, Math.floor(Number(task.repeat.interval_minutes)))
        : null
  },
  auto_delete_at: task?.auto_delete_at ?? null,
  notify_in_site: task?.notify_in_site !== false,
  notify_voice: task?.notify_voice !== false
});

const normalizeExpense = (expense) => ({
  title: String(expense?.title ?? "Xarajat").trim(),
  amount: Number.isFinite(Number(expense?.amount)) ? Math.max(0, Math.floor(Number(expense.amount))) : 0,
  note: String(expense?.note ?? "").trim(),
  spent_at: expense?.spent_at ?? null,
  category: String(expense?.category ?? "general").trim() || "general"
});

const normalizeNote = (note) => ({
  title: String(note?.title ?? "").trim(),
  body: String(note?.body ?? note?.note ?? "").trim()
});

const normalizeAssistantPayload = (payload) => {
  const intent = allowedIntents.has(payload?.intent) ? payload.intent : "chat";
  const assistantReply = String(payload?.assistant_reply ?? "").trim();
  const tasks = Array.isArray(payload?.tasks) ? payload.tasks.map(normalizeTask).filter((task) => task.title) : [];
  const expenses = Array.isArray(payload?.expenses)
    ? payload.expenses.map(normalizeExpense).filter((expense) => expense.title && expense.amount > 0)
    : [];
  const notes = Array.isArray(payload?.notes) ? payload.notes.map(normalizeNote).filter((note) => note.title) : [];
  const financeProfile = payload?.finance_profile && typeof payload.finance_profile === "object"
    ? {
        monthly_income: Number.isFinite(Number(payload.finance_profile.monthly_income))
          ? Math.max(0, Math.floor(Number(payload.finance_profile.monthly_income)))
          : 0,
        monthly_limit: Number.isFinite(Number(payload.finance_profile.monthly_limit))
          ? Math.max(0, Math.floor(Number(payload.finance_profile.monthly_limit)))
          : 0
      }
    : null;

  if (!assistantReply) {
    throw new HttpError(502, "Gemini assistant_reply qaytarmadi");
  }

  return {
    intent,
    assistant_reply: assistantReply,
    tasks,
    expenses,
    notes,
    finance_profile: financeProfile
  };
};

export const getKotibaReply = async (userText, context = {}) => {
  const systemPrompt = buildKotibaMasterPrompt(context);

  try {
    let rawText = "";

    if (env.aiProvider === "openai") {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.openAiApiKey}`
        },
        body: JSON.stringify({
          model: env.openAiModel,
          instructions: systemPrompt,
          input: `Foydalanuvchi xabari uchun faqat valid JSON qaytaring. Kotiba vazifasidan chiqib ketmang. Xabar: ${userText}`,
          temperature: 0,
          text: {
            format: {
              type: "json_object"
            }
          }
        })
      });

      const payload = await response.json();

      if (!response.ok) {
        const errorMessage = payload?.error?.message || "OpenAI servisida xatolik";

        if (response.status === 429) {
          throw new HttpError(503, "OpenAI limiti tugagan yoki billing yoqilmagan.", payload);
        }

        if (response.status === 401) {
          throw new HttpError(503, "OpenAI API key noto'g'ri yoki bekor qilingan.", payload);
        }

        throw new HttpError(502, errorMessage, payload);
      }

      rawText = extractOpenAiText(payload);
    } else {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${env.geminiModel}:generateContent?key=${env.geminiApiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [
                {
                  text: systemPrompt
                }
              ]
            },
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0,
              topP: 0.4
            },
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: `Foydalanuvchi xabari: ${userText}`
                  }
                ]
              }
            ]
          })
        }
      );

      const payload = await response.json();

      if (!response.ok) {
        const errorMessage = payload?.error?.message || "Gemini servisida xatolik";

        if (response.status === 429) {
          throw new HttpError(
            503,
            "Gemini limiti tugagan yoki billing yoqilmagan. Yangi API key yoki billing kerak.",
            payload
          );
        }

        if (response.status === 400 && payload?.error?.status === "INVALID_ARGUMENT") {
          throw new HttpError(503, "Gemini API key noto'g'ri yoki model mavjud emas.", payload);
        }

        throw new HttpError(502, errorMessage, payload);
      }

      rawText = extractGeminiText(payload);
    }

    if (!rawText) {
      throw new HttpError(502, env.aiProvider === "openai" ? "OpenAI bo'sh javob qaytardi" : "Gemini bo'sh javob qaytardi");
    }

    return normalizeAssistantPayload(extractJsonObject(rawText));
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    throw new HttpError(502, env.aiProvider === "openai" ? "OpenAI servisida xatolik" : "Gemini servisida xatolik", {
      details: error?.message
    });
  }
};

