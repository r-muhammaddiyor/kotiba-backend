import { Router } from "express";
import { getNotes, patchNote, postNote, removeNote } from "../controllers/note.controller.js";

const noteRouter = Router();

noteRouter.get("/", getNotes);
noteRouter.post("/", postNote);
noteRouter.patch("/:id", patchNote);
noteRouter.delete("/:id", removeNote);

export default noteRouter;
