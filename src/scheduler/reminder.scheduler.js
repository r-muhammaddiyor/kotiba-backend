import cron from "node-cron";
import { enqueueJob } from "../services/jobQueue.service.js";
import { lockDueReminderTasks } from "../services/reminder.service.js";

let isRunning = false;

export const runReminderSweepOnce = async (now = new Date(), options = {}) => {
  if (isRunning) {
    return {
      lockedCount: 0,
      mode: options.useQueue ? "queue" : "direct",
      skipped: true,
      reason: "already-running"
    };
  }

  isRunning = true;

  try {
    const taskIds = await lockDueReminderTasks(now);

    if (options.useQueue) {
      for (const taskId of taskIds) {
        enqueueJob(
          "deliver-reminder",
          { taskId },
          {
            maxAttempts: 3,
            backoffMs: 1500
          }
        );
      }

      return {
        lockedCount: taskIds.length,
        mode: "queue",
        skipped: false
      };
    }

    const { processReminderTask } = await import("../services/reminder.service.js");
    const results = [];

    for (const taskId of taskIds) {
      results.push(await processReminderTask(taskId));
    }

    return {
      lockedCount: taskIds.length,
      processedCount: results.length,
      mode: "direct",
      skipped: false,
      results
    };
  } finally {
    isRunning = false;
  }
};

export const startReminderScheduler = () => {
  cron.schedule("* * * * *", async () => {
    try {
      await runReminderSweepOnce(new Date(), { useQueue: true });
    } catch (error) {
      console.error("Reminder scheduler failed", error);
    }
  });
};
