import cors from "cors";
import express from "express";
import morgan from "morgan";
import { env } from "./config/env.js";
import apiRouter from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";

const allowedOrigins = new Set(
  String(env.clientUrl || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
);

const isLocalNetworkOrigin = (origin) =>
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin) ||
  /^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/i.test(origin) ||
  /^https?:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/i.test(origin) ||
  /^https?:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}(:\d+)?$/i.test(origin);

const isTrustedHostedOrigin = (origin) => /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin);

export const createApp = () => {
  const app = express();

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) {
          callback(null, true);
          return;
        }

        if (
          allowedOrigins.has(origin) ||
          isTrustedHostedOrigin(origin) ||
          (env.nodeEnv !== "production" && isLocalNetworkOrigin(origin))
        ) {
          callback(null, true);
          return;
        }

        callback(new Error("CORS origin blocked"));
      },
      credentials: true
    })
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(morgan("dev"));

  app.use("/api", apiRouter);
  app.use(errorHandler);

  return app;
};
