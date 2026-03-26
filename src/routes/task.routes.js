import { Router } from "express";
import {
  completeTask,
  createTask,
  deleteTask,
  listTasks,
  updateTask
} from "../controllers/task.controller.js";

const taskRouter = Router();

taskRouter.get("/", listTasks);
taskRouter.post("/", createTask);
taskRouter.patch("/:id", updateTask);
taskRouter.patch("/:id/complete", completeTask);
taskRouter.delete("/:id", deleteTask);

export default taskRouter;
