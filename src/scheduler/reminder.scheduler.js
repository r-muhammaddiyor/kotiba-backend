import cron from "node-cron";
import { enqueueJob } from "../services/jobQueue.service.js";
import { lockDueReminderTasks } from "../services/reminder.service.js";

let isRunning = false;

export const startReminderScheduler = () => {
  cron.schedule("* * * * *", async () => {
    if (isRunning) {
      return;
    }

    isRunning = true;

    try {
      const taskIds = await lockDueReminderTasks(new Date());

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
    } catch (error) {
      console.error("Reminder scheduler failed", error);
    } finally {
      isRunning = false;
    }
  });
};
