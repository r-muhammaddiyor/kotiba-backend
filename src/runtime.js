import { createApp } from "./app.js";
import { connectDb } from "./config/db.js";
import { env } from "./config/env.js";
import { startJobQueue } from "./services/jobQueue.service.js";
import { registerReminderWorker } from "./workers/reminder.worker.js";

let appInstance = null;
let workersReady = false;

export const ensureRuntimeReady = async () => {
  await connectDb(env.mongoUri);

  if (!env.isServerless && !workersReady) {
    registerReminderWorker();
    startJobQueue();
    workersReady = true;
  }

  if (!appInstance) {
    appInstance = createApp();
  }

  return appInstance;
};
