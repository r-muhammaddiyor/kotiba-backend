import mongoose from "mongoose";
import { Task } from "../models/Task.js";
import { createManualTask } from "../services/task.service.js";
import { HttpError } from "../utils/httpError.js";

const toPositiveMinutes = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.floor(parsed);
};

const buildReminderAt = (scheduleAt, remindBeforeMinutes) => {
  if (!scheduleAt) {
    return null;
  }

  return new Date(scheduleAt.getTime() - remindBeforeMinutes * 60 * 1000);
};

const validateId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new HttpError(400, "Noto'g'ri task ID");
  }
};

export const listTasks = async (req, res, next) => {
  try {
    const tasks = await Task.find({ user: req.auth.userId }).sort({ createdAt: -1 });
    res.json({ success: true, data: tasks });
  } catch (error) {
    next(error);
  }
};

export const createTask = async (req, res, next) => {
  try {
    const { title } = req.body;

    if (!title || !title.trim()) {
      throw new HttpError(400, "Task nomi majburiy");
    }

    const task = await createManualTask(req.auth.userId, req.body);

    res.status(201).json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
};

export const updateTask = async (req, res, next) => {
  try {
    const { id } = req.params;
    validateId(id);

    const update = { ...req.body };
    let remindBeforeMinutesChanged = false;

    if (Object.prototype.hasOwnProperty.call(update, "title") && !String(update.title).trim()) {
      throw new HttpError(400, "Task nomi bo'sh bo'lishi mumkin emas");
    }

    if (Object.prototype.hasOwnProperty.call(update, "note") && !Object.prototype.hasOwnProperty.call(update, "description")) {
      update.description = update.note;
    }

    if (Object.prototype.hasOwnProperty.call(update, "description") && !Object.prototype.hasOwnProperty.call(update, "note")) {
      update.note = update.description;
    }

    if (Object.prototype.hasOwnProperty.call(update, "locationLabel")) {
      update.locationLabel = String(update.locationLabel || "").trim();
    }

    if (Object.prototype.hasOwnProperty.call(update, "scheduleAt")) {
      update.scheduleAt = update.scheduleAt ? new Date(update.scheduleAt) : null;
      update.dueAt = update.scheduleAt;
    }

    if (Object.prototype.hasOwnProperty.call(update, "remindBeforeMinutes")) {
      update.remindBeforeMinutes = toPositiveMinutes(update.remindBeforeMinutes);
      remindBeforeMinutesChanged = true;
    }

    if (Object.prototype.hasOwnProperty.call(update, "reminderAt")) {
      update.reminderAt = update.reminderAt ? new Date(update.reminderAt) : null;
      update.reminderSent = false;
      update.reminderLockedAt = null;
    }

    if (Object.prototype.hasOwnProperty.call(update, "dueAt")) {
      update.dueAt = update.dueAt ? new Date(update.dueAt) : null;
    }

    if (Object.prototype.hasOwnProperty.call(update, "reminderEnabled")) {
      update.reminderLockedAt = null;
    }

    if (Object.prototype.hasOwnProperty.call(update, "autoDeleteAt")) {
      update.autoDeleteAt = update.autoDeleteAt ? new Date(update.autoDeleteAt) : null;
    }

    if (Object.prototype.hasOwnProperty.call(update, "scheduleAt") || remindBeforeMinutesChanged) {
      const currentTask =
        Object.prototype.hasOwnProperty.call(update, "scheduleAt") &&
        Object.prototype.hasOwnProperty.call(update, "remindBeforeMinutes")
          ? null
          : await Task.findOne({ _id: id, user: req.auth.userId }, { scheduleAt: 1, remindBeforeMinutes: 1 });

      if (!currentTask) {
        if (!Object.prototype.hasOwnProperty.call(update, "scheduleAt") && !Object.prototype.hasOwnProperty.call(update, "remindBeforeMinutes")) {
          throw new HttpError(404, "Task topilmadi");
        }
      }

      const scheduleAt = Object.prototype.hasOwnProperty.call(update, "scheduleAt")
        ? update.scheduleAt
        : currentTask?.scheduleAt ?? null;
      const remindBeforeMinutes = Object.prototype.hasOwnProperty.call(update, "remindBeforeMinutes")
        ? update.remindBeforeMinutes
        : currentTask?.remindBeforeMinutes ?? 0;

      update.reminderAt = buildReminderAt(scheduleAt, remindBeforeMinutes);
      update.reminderEnabled =
        Object.prototype.hasOwnProperty.call(update, "reminderEnabled") ? Boolean(update.reminderEnabled) : Boolean(update.reminderAt);
      update.reminderSent = false;
      update.reminderLockedAt = null;
    }

    const task = await Task.findOneAndUpdate({ _id: id, user: req.auth.userId }, update, {
      new: true,
      runValidators: true
    });

    if (!task) {
      throw new HttpError(404, "Task topilmadi");
    }

    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
};

export const deleteTask = async (req, res, next) => {
  try {
    const { id } = req.params;
    validateId(id);

    const task = await Task.findOneAndDelete({ _id: id, user: req.auth.userId });
    if (!task) {
      throw new HttpError(404, "Task topilmadi");
    }

    res.json({ success: true, message: "Task o'chirildi" });
  } catch (error) {
    next(error);
  }
};

export const completeTask = async (req, res, next) => {
  try {
    const { id } = req.params;
    validateId(id);

    const task = await Task.findOneAndUpdate(
      { _id: id, user: req.auth.userId },
      {
        isCompleted: true,
        reminderEnabled: false,
        reminderSent: true,
        reminderLockedAt: null
      },
      { new: true }
    );

    if (!task) {
      throw new HttpError(404, "Task topilmadi");
    }

    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
};
