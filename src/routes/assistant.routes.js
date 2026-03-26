import { Router } from "express";
import { handleAssistantText } from "../controllers/assistant.controller.js";

const assistantRouter = Router();

assistantRouter.post("/respond", handleAssistantText);

export default assistantRouter;
