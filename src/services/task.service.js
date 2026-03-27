import { Task } from "../models/Task.js";
import { HttpError } from "../utils/httpError.js";

const repeatTypes = new Set(["none", "hourly", "daily", "weekly", "custom"]);
const genericAssistantTitles = new Set([
  "",
  "eslatma",
  "reminder",
  "task",
  "vazifa",
  "bugungi vazifa",
  "bugungi eslatma",
  "kechki eslatma",
  "ertalabki eslatma",
  "kundalik eslatma",
  "kechki reminder",
  "ertalabki reminder"
]);

const reminderNoisePattern =
  /\b(eslatma|reminder|task|vazifa|foydalanuvchi|bugun|ertaga|indin|kechki|ertalabki|ertalab|kechqurun|kechasi|tushda|tushdagi|tongda|soat|minut|daqiqa|soatlarda|keyin|kegin|keyn|avval|oldin|kerak|vaqti|kelganda)\b/iu;

const cleanValue = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .replace(/[.,;:!?]+$/g, "")
    .trim();

const upperFirst = (value) => {
  const cleaned = cleanValue(value);
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : "";
};

const normalizeSourceForTitle = (value) => {
  let normalized = cleanValue(value)
    .toLowerCase()
    .replace(/[\u2019`]/g, "'")
    .replace(/\bbugun\b/gu, " ")
    .replace(/\bertaga\b/gu, " ")
    .replace(/\bindin\b/gu, " ")
    .replace(/\b(dushanba|seshanba|chorshanba|payshanba|juma|shanba|yakshanba)\b/gu, " ")
    .replace(/\b(ertalabki|ertalab|kechki|kechqurun|kechasi|tushdagi|tushda|kunduzi|tongda)\b/gu, " ")
    .replace(/\b\d+\s*(minut|daqiqa|soat|kun)(dan)?\s*(keyin|kegin|keyn|so'ng)\b/gu, " ")
    .replace(/\b(bir|ikki|uch|to'rt|besh|olti|yetti|sakkiz|to'qqiz|o'n|o'n bir|o'n ikki)\s*(minut|daqiqa|soat|kun)(dan)?\s*(keyin|kegin|keyn|so'ng)\b/gu, " ")
    .replace(/\bsoat\s*\d{1,2}([:.]\d{2})?\s*(da|ga)?\b/gu, " ")
    .replace(/\b\d{1,2}([:.]\d{2})?\s*(da|ga)\b/gu, " ")
    .replace(/\b(eslat(?:ib)?(?:\s+qo['\u2019`]?y)?|ayt(?:ib)?(?:\s+qo['\u2019`]?y)?|ogohlantir(?:ib)?|qo['\u2019`]?y)\b/gu, " ")
    .replace(/\bqilishni\b/gu, " qilish ")
    .replace(/\bichishni\b/gu, " ichish ")
    .replace(/\bborishni\b/gu, " borish ")
    .replace(/\bolishni\b/gu, " olish ")
    .replace(/\byuborishni\b/gu, " yuborish ")
    .replace(/\byozishni\b/gu, " yozish ")
    .replace(/\bchiqishni\b/gu, " chiqish ")
    .replace(/\bturishni\b/gu, " turish ")
    .replace(/\bmeni\b/gu, " ")
    .replace(/\bmenga\b/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized;
};

const extractTitleFromSource = (value) => {
  const source = normalizeSourceForTitle(value);
  if (!source) {
    return "";
  }

  const callRecipientMatch = source.match(/\b([\p{L}'-]+ga)\s+qo'ng'iroq\b/u);
  if (callRecipientMatch) {
    return upperFirst(`${callRecipientMatch[1]} qo'ng'iroq`);
  }

  const directPatterns = [
    { pattern: /\bsuv\s+ich/iu, title: "Suv ichish" },
    { pattern: /\bdori(?:ni)?\s+ich/iu, title: "Dori ichish" },
    { pattern: /\b(?:doktor|doxtir|shifokor)(?:ga)?\b.*\bbor/iu, title: "Doktorga borish" },
    { pattern: /\bbankka\b.*\bbor/iu, title: "Bankka borish" },
    { pattern: /\baeroportga\b.*\bbor/iu, title: "Aeroportga borish" },
    { pattern: /\bmarketga\b.*\bbor/iu, title: "Marketga borish" },
    { pattern: /\bofisga\b.*\bbor/iu, title: "Ofisga borish" },
    { pattern: /\buchrashuv\b/iu, title: "Uchrashuv" },
    { pattern: /\byig'ilish\b/iu, title: "Yig'ilish" },
    { pattern: /\bhisobot\b.*\byubor/iu, title: "Hisobot yuborish" },
    { pattern: /\bhujjat(?:larni)?\b.*\bol/iu, title: "Hujjatlarni olish" },
    { pattern: /\buyg'ot/iu, title: "Uyg'onish" },
    { pattern: /\byugur/iu, title: "Yugurish" },
    { pattern: /\bsport\b/iu, title: "Sport" },
    { pattern: /\bnamoz\b/iu, title: "Namozga turish" },
    { pattern: /\bqo'ng'iroq\b/iu, title: "Qo'ng'iroq" }
  ];

  for (const { pattern, title } of directPatterns) {
    if (pattern.test(source)) {
      return title;
    }
  }

  const verbalNounMatch = source.match(
    /\b([\p{L}'-]+(?:\s+[\p{L}'-]+){0,3})\s+(ichish|borish|qilish|olish|yozish|yuborish|chiqish|turish)\b/u
  );

  if (verbalNounMatch) {
    const candidate = `${verbalNounMatch[1]} ${verbalNounMatch[2]}`.trim();
    return upperFirst(candidate);
  }

  return "";
};

const shouldReplaceAssistantTitle = (title) => {
  const normalized = cleanValue(title).toLowerCase();
  if (!normalized) {
    return true;
  }

  if (genericAssistantTitles.has(normalized)) {
    return true;
  }

  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  if (wordCount > 4) {
    return true;
  }

  if (/\bbor\b/u.test(normalized)) {
    return true;
  }

  return reminderNoisePattern.test(normalized) && wordCount >= 2;
};

const refineAssistantTitle = (title, ...sources) => {
  if (!shouldReplaceAssistantTitle(title)) {
    return upperFirst(title);
  }

  for (const source of sources) {
    const extracted = extractTitleFromSource(source);
    if (extracted) {
      return extracted;
    }
  }

  const cleaned = cleanValue(title)
    .replace(/\b(bugun|ertaga|kechki|ertalabki|ertalab|kechqurun|kechasi|tushda|tushdagi|soat)\b/giu, " ")
    .replace(/\bbor\b/giu, " ")
    .replace(/\s+/g, " ")
    .trim();

  return upperFirst(cleaned || "Eslatma");
};

const parseDate = (value) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toPositiveMinutes = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.floor(parsed);
};

const normalizeRepeat = (repeat) => {
  const type = repeatTypes.has(repeat?.type) ? repeat.type : "none";
  const intervalMinutes = type === "custom" ? toPositiveMinutes(repeat?.interval_minutes ?? repeat?.intervalMinutes) || null : null;

  return {
    type,
    intervalMinutes
  };
};

const buildReminderAt = (scheduleAt, remindBeforeMinutes) => {
  if (!scheduleAt) {
    return null;
  }

  return new Date(scheduleAt.getTime() - remindBeforeMinutes * 60 * 1000);
};

export const buildDefaultActionText = (title, remindBeforeMinutes) => {
  const normalizedTitle = String(title || "eslatma").trim().toLowerCase();

  if (remindBeforeMinutes >= 1440) {
    const days = Math.floor(remindBeforeMinutes / 1440);
    return days === 1 ? `Ertaga ${normalizedTitle} bor` : `${days} kundan keyin ${normalizedTitle} bor`;
  }

  if (remindBeforeMinutes >= 60) {
    const hours = Math.floor(remindBeforeMinutes / 60);
    return `${hours} soatdan keyin ${normalizedTitle} bor`;
  }

  if (remindBeforeMinutes > 0) {
    return `${remindBeforeMinutes} minutdan keyin ${normalizedTitle} bor`;
  }

  return `${String(title || "Eslatma")} vaqti keldi`;
};

export const buildTaskDocument = (taskInput, options = {}) => {
  const rawTitle = String(taskInput?.title ?? "").trim();
  const title =
    options.source === "assistant"
      ? refineAssistantTitle(rawTitle, options.sourceText, taskInput?.note, taskInput?.action_text, taskInput?.actionText)
      : rawTitle;
  if (!title) {
    return null;
  }

  const note = String(taskInput?.note ?? taskInput?.description ?? "").trim();
  const locationLabel = String(taskInput?.location_label ?? taskInput?.locationLabel ?? "").trim();
  const scheduleAt =
    parseDate(taskInput?.schedule_at ?? taskInput?.scheduleAt) ??
    parseDate(taskInput?.reminderAt) ??
    parseDate(taskInput?.dueAt);
  const remindBeforeMinutes = toPositiveMinutes(taskInput?.remind_before_minutes ?? taskInput?.remindBeforeMinutes);
  const actionText = String(
    taskInput?.action_text ?? taskInput?.actionText ?? buildDefaultActionText(title, remindBeforeMinutes)
  ).trim();
  const repeat = normalizeRepeat(taskInput?.repeat);
  const autoDeleteAt = parseDate(taskInput?.auto_delete_at ?? taskInput?.autoDeleteAt);
  const notifyInSite = taskInput?.notify_in_site !== false && taskInput?.notifyInSite !== false;
  const notifyVoice = taskInput?.notify_voice !== false && taskInput?.notifyVoice !== false;
  const reminderAt =
    parseDate(taskInput?.reminderAt) ??
    buildReminderAt(scheduleAt, remindBeforeMinutes);

  return {
    title,
    note,
    locationLabel,
    description: note,
    actionText,
    scheduleAt,
    dueAt: scheduleAt,
    reminderAt,
    remindBeforeMinutes,
    repeat,
    autoDeleteAt,
    notifyInSite,
    notifyVoice,
    reminderEnabled: Boolean(reminderAt),
    reminderSent: false,
    source: options.source ?? "manual",
    assistantIntent: options.assistantIntent ?? null
  };
};

export const createAssistantTasks = async ({ userId, intent, tasks, sourceText }) => {
  const docs = (tasks ?? [])
    .map((task) => {
      const doc = buildTaskDocument(task, {
        source: "assistant",
        assistantIntent: intent,
        sourceText: task?.source_text || sourceText
      });
      return doc
        ? {
            ...doc,
            user: userId
          }
        : null;
    })
    .filter(Boolean);

  if (!docs.length) {
    return [];
  }

  return Task.insertMany(docs);
};

export const normalizeAssistantTasks = (tasks, sourceText) =>
  (tasks ?? []).map((task) => {
    const remindBeforeMinutes = toPositiveMinutes(task?.remind_before_minutes ?? task?.remindBeforeMinutes);
    const originalTitle = cleanValue(task?.title);
    const title = refineAssistantTitle(task?.title, sourceText, task?.note, task?.action_text, task?.actionText);
    const actionText = cleanValue(task?.action_text ?? task?.actionText);
    const shouldReplaceActionText =
      !actionText ||
      originalTitle.toLowerCase() !== title.toLowerCase() ||
      /\b(foydalanuvchi|requested|request|so'radi|yaratildi)\b/iu.test(actionText);

    return {
      ...task,
      source_text: sourceText,
      title,
      action_text: shouldReplaceActionText ? buildDefaultActionText(title, remindBeforeMinutes) : actionText
    };
  });

export const createManualTask = async (userId, payload) => {
  const baseDoc = buildTaskDocument(payload, { source: "manual", assistantIntent: null });
  const doc = baseDoc
    ? {
        ...baseDoc,
        user: userId
      }
    : null;

  if (!doc) {
    throw new HttpError(400, "Task ma'lumotlari noto'g'ri");
  }

  return Task.create(doc);
};
