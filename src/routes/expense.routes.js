import { Router } from "express";
import {
  createExpenseEntry,
  deleteExpenseEntry,
  getExpenses,
  getExpensesSummary,
  updateExpenseEntry
} from "../controllers/expense.controller.js";

const expenseRouter = Router();

expenseRouter.get("/", getExpenses);
expenseRouter.get("/summary", getExpensesSummary);
expenseRouter.post("/", createExpenseEntry);
expenseRouter.patch("/:id", updateExpenseEntry);
expenseRouter.delete("/:id", deleteExpenseEntry);

export default expenseRouter;
