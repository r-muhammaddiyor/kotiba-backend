import { Router } from "express";
import {
  clearConversation,
  deleteConversationItem,
  getConversationHistory
} from "../controllers/conversation.controller.js";

const conversationRouter = Router();

conversationRouter.get("/", getConversationHistory);
conversationRouter.delete("/", clearConversation);
conversationRouter.delete("/:id", deleteConversationItem);

export default conversationRouter;
