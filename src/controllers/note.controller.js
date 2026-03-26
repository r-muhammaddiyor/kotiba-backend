import mongoose from "mongoose";
import { createNote, deleteNote, listNotes, updateNote } from "../services/note.service.js";
import { HttpError } from "../utils/httpError.js";

const validateId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new HttpError(400, "Noto'g'ri kundalik ID");
  }
};

export const getNotes = async (req, res, next) => {
  try {
    const notes = await listNotes(req.auth.userId);
    res.json({ success: true, data: notes });
  } catch (error) {
    next(error);
  }
};

export const postNote = async (req, res, next) => {
  try {
    const note = await createNote(req.auth.userId, req.body);
    res.status(201).json({ success: true, data: note });
  } catch (error) {
    next(error);
  }
};

export const patchNote = async (req, res, next) => {
  try {
    validateId(req.params.id);
    const note = await updateNote(req.auth.userId, req.params.id, req.body);
    res.json({ success: true, data: note });
  } catch (error) {
    next(error);
  }
};

export const removeNote = async (req, res, next) => {
  try {
    validateId(req.params.id);
    await deleteNote(req.auth.userId, req.params.id);
    res.json({ success: true, message: "Kundalik o'chirildi" });
  } catch (error) {
    next(error);
  }
};
