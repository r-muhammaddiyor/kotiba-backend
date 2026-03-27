import { env } from "../config/env.js";
import { runReminderSweepOnce } from "../scheduler/reminder.scheduler.js";
import { HttpError } from "../utils/httpError.js";

const getCronToken = (req) => {
  const authorization = req.get("authorization") || "";
  const [scheme, token] = authorization.split(" ");

  if (scheme === "Bearer" && token) {
    return token;
  }

  return req.get("x-cron-secret") || "";
};

export const runReminderCron = async (req, res, next) => {
  try {
    if (!env.cronSecret) {
      throw new HttpError(503, "CRON_SECRET sozlanmagan");
    }

    const token = getCronToken(req);
    if (!token || token !== env.cronSecret) {
      throw new HttpError(401, "Cron so'rovi rad etildi");
    }

    const summary = await runReminderSweepOnce(new Date(), {
      useQueue: false
    });

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    next(error);
  }
};
