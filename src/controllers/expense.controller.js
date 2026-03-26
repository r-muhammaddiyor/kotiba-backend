import mongoose from "mongoose";
import { createExpense, deleteExpense, getExpenseSummary, listExpenses, updateExpense } from "../services/expense.service.js";
import { HttpError } from "../utils/httpError.js";

const validateId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new HttpError(400, "Noto'g'ri xarajat ID");
  }
};

export const getExpenses = async (req, res, next) => {
  try {
    const expenses = await listExpenses(req.auth.userId);
    res.json({ success: true, data: expenses });
  } catch (error) {
    next(error);
  }
};

export const getExpensesSummary = async (req, res, next) => {
  try {
    const summary = await getExpenseSummary(req.auth.userId);
    res.json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
};

export const createExpenseEntry = async (req, res, next) => {
  try {
    const expense = await createExpense(req.auth.userId, req.body ?? {});
    res.status(201).json({ success: true, data: expense });
  } catch (error) {
    next(error);
  }
};

export const updateExpenseEntry = async (req, res, next) => {
  try {
    validateId(req.params.id);
    const expense = await updateExpense(req.auth.userId, req.params.id, req.body ?? {});
    res.json({ success: true, data: expense });
  } catch (error) {
    next(error);
  }
};

export const deleteExpenseEntry = async (req, res, next) => {
  try {
    validateId(req.params.id);
    await deleteExpense(req.auth.userId, req.params.id);
    res.json({ success: true, message: "Xarajat o'chirildi" });
  } catch (error) {
    next(error);
  }
};
