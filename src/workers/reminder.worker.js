import { registerJobHandler } from "../services/jobQueue.service.js";
import { processReminderTask } from "../services/reminder.service.js";

let workerRegistered = false;

export const registerReminderWorker = () => {
  if (workerRegistered) {
    return;
  }

  registerJobHandler("deliver-reminder", async ({ taskId }) => {
    await processReminderTask(taskId);
  });

  workerRegistered = true;
};
