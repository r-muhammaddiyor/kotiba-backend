import { Task } from "../models/Task.js";
import { HttpError } from "../utils/httpError.js";

const repeatTypes = new Set(["none", "hourly", "daily", "weekly", "custom"]);

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
  const title = String(taskInput?.title ?? "").trim();
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

export const createAssistantTasks = async ({ userId, intent, tasks }) => {
  const docs = (tasks ?? [])
    .map((task) => {
      const doc = buildTaskDocument(task, { source: "assistant", assistantIntent: intent });
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
