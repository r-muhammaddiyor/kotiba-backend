import { Router } from "express";
import { runReminderCron } from "../controllers/cron.controller.js";

const cronRouter = Router();

cronRouter.get("/reminders", runReminderCron);

export default cronRouter;
