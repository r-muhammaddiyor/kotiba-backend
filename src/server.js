import { createApp } from "./app.js";
import { connectDb } from "./config/db.js";
import { env } from "./config/env.js";
import { startReminderScheduler } from "./scheduler/reminder.scheduler.js";
import { startJobQueue } from "./services/jobQueue.service.js";
import { registerReminderWorker } from "./workers/reminder.worker.js";

const bootstrap = async () => {
  await connectDb(env.mongoUri);

  registerReminderWorker();
  startJobQueue();

  const app = createApp();

  app.listen(env.port, () => {
    console.log(`Server running at http://localhost:${env.port}`);
  });

  startReminderScheduler();
};

bootstrap().catch((error) => {
  console.error("Boot failed", error);
  process.exit(1);
});
