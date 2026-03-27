import { env } from "./config/env.js";
import { startReminderScheduler } from "./scheduler/reminder.scheduler.js";
import { ensureRuntimeReady } from "./runtime.js";

const bootstrap = async () => {
  const app = await ensureRuntimeReady();

  app.listen(env.port, () => {
    console.log(`Server running at http://localhost:${env.port}`);
  });

  startReminderScheduler();
};

bootstrap().catch((error) => {
  console.error("Boot failed", error);
  process.exit(1);
});
