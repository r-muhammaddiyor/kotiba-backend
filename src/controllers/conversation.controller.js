import mongoose from "mongoose";
import {
  clearConversationHistory,
  deleteConversationMessage,
  listConversationMessages
} from "../services/conversation.service.js";
import { HttpError } from "../utils/httpError.js";

export const getConversationHistory = async (req, res, next) => {
  try {
    const messages = await listConversationMessages(req.auth.userId);
    res.json({
      success: true,
      data: messages
    });
  } catch (error) {
    next(error);
  }
};

export const clearConversation = async (req, res, next) => {
  try {
    const result = await clearConversationHistory(req.auth.userId);
    res.json({
      success: true,
      data: result,
      message: "Suhbat tarixi tozalandi"
    });
  } catch (error) {
    next(error);
  }
};

export const deleteConversationItem = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new HttpError(400, "Noto'g'ri xabar ID");
    }

    const result = await deleteConversationMessage(req.auth.userId, id);
    res.json({
      success: true,
      data: result,
      message: "Xabar o'chirildi"
    });
  } catch (error) {
    next(error);
  }
};
