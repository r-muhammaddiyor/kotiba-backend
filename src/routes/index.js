import { Router } from "express";
import authRouter from "./auth.routes.js";
import assistantRouter from "./assistant.routes.js";
import conversationRouter from "./conversation.routes.js";
import dashboardRouter from "./dashboard.routes.js";
import voiceRouter from "./voice.routes.js";
import taskRouter from "./task.routes.js";
import pushRouter from "./push.routes.js";
import expenseRouter from "./expense.routes.js";
import { requireAuth } from "../middleware/auth.js";

const apiRouter = Router();

apiRouter.get("/health", (req, res) => {
  res.json({ success: true, message: "AI Secretary API running" });
});

apiRouter.use("/auth", authRouter);
apiRouter.use(requireAuth);
apiRouter.use("/dashboard", dashboardRouter);
apiRouter.use("/assistant", assistantRouter);
apiRouter.use("/conversations", conversationRouter);
apiRouter.use("/voice", voiceRouter);
apiRouter.use("/tasks", taskRouter);
apiRouter.use("/push", pushRouter);
apiRouter.use("/expenses", expenseRouter);

export default apiRouter;
