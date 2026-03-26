import { Task } from "../models/Task.js";
import { sendPushToUser } from "./push.service.js";

const getRepeatIntervalMinutes = (task) => {
  switch (task.repeat?.type) {
    case "hourly":
      return 60;
    case "daily":
      return 24 * 60;
    case "weekly":
      return 7 * 24 * 60;
    case "custom":
      return Number(task.repeat?.intervalMinutes) || null;
    default:
      return null;
  }
};

const getNextScheduleAt = (task) => {
  const intervalMinutes = getRepeatIntervalMinutes(task);
  if (!intervalMinutes) {
    return null;
  }

  const baseDate = task.scheduleAt ?? task.reminderAt;
  if (!baseDate) {
    return null;
  }

  return new Date(baseDate.getTime() + intervalMinutes * 60 * 1000);
};

const getReminderAt = (scheduleAt, remindBeforeMinutes) => {
  if (!scheduleAt) {
    return null;
  }

  return new Date(scheduleAt.getTime() - Number(remindBeforeMinutes || 0) * 60 * 1000);
};

export const lockDueReminderTasks = async (now = new Date(), limit = 50) => {
  await Task.deleteMany({
    autoDeleteAt: { $lte: now }
  });

  const candidates = await Task.find(
    {
      reminderEnabled: true,
      reminderSent: false,
      isCompleted: false,
      reminderAt: { $lte: now },
      reminderLockedAt: null
    },
    { _id: 1 }
  )
    .sort({ reminderAt: 1 })
    .limit(limit)
    .lean();

  const lockedTaskIds = [];

  for (const candidate of candidates) {
    const locked = await Task.findOneAndUpdate(
      {
        _id: candidate._id,
        reminderEnabled: true,
        reminderSent: false,
        isCompleted: false,
        reminderLockedAt: null
      },
      {
        reminderLockedAt: now
      }
    );

    if (locked) {
      lockedTaskIds.push(String(candidate._id));
    }
  }

  return lockedTaskIds;
};

export const processReminderTask = async (taskId) => {
  const task = await Task.findById(taskId);
  if (!task) {
    return { status: "missing" };
  }

  try {
    const now = new Date();
    const stillDue =
      task.reminderEnabled &&
      !task.reminderSent &&
      !task.isCompleted &&
      task.reminderAt &&
      task.reminderAt <= now;

    if (!stillDue) {
      task.reminderLockedAt = null;
      await task.save();
      return { status: "skipped" };
    }

    let deliveryHandled = !task.notifyInSite;

    if (task.notifyInSite) {
      const body = task.actionText || task.description || `${task.title} vazifasi uchun eslatma`;
      const pushResult = await sendPushToUser(task.user, {
        title: "KotibaAI",
        body,
        url: "/"
      });

      deliveryHandled = !pushResult.skipped && pushResult.sent > 0;
    }

    if (!deliveryHandled) {
      task.reminderLockedAt = null;
      await task.save();
      return { status: "deferred" };
    }

    const nextScheduleAt = getNextScheduleAt(task);

    if (nextScheduleAt && (!task.autoDeleteAt || nextScheduleAt <= task.autoDeleteAt)) {
      task.scheduleAt = nextScheduleAt;
      task.dueAt = nextScheduleAt;
      task.reminderAt = getReminderAt(nextScheduleAt, task.remindBeforeMinutes);
      task.reminderSent = false;
    } else {
      task.reminderSent = true;
      task.reminderEnabled = false;
    }

    task.reminderLockedAt = null;
    await task.save();

    return {
      status: nextScheduleAt ? "rescheduled" : "completed"
    };
  } catch (error) {
    task.reminderLockedAt = null;
    await task.save().catch(() => null);
    throw error;
  }
};
