import { Note } from "../models/Note.js";
import { HttpError } from "../utils/httpError.js";

const normalizeNoteInput = (payload, options = {}) => {
  const title = String(payload?.title ?? "").trim();
  const body = String(payload?.body ?? payload?.note ?? "").trim();

  if (!title) {
    throw new HttpError(400, "Kundalik sarlavhasi kerak");
  }

  return {
    title,
    body,
    source: options.source ?? "manual"
  };
};

export const createNote = async (userId, payload, options = {}) => {
  const doc = normalizeNoteInput(payload, options);
  return Note.create({
    ...doc,
    user: userId
  });
};

export const createAssistantNotes = async (userId, notes = []) => {
  const docs = notes
    .map((note) => normalizeNoteInput(note, { source: "assistant" }))
    .map((doc) => ({
      ...doc,
      user: userId
    }));

  if (!docs.length) {
    return [];
  }

  return Note.insertMany(docs);
};

export const listNotes = async (userId) => Note.find({ user: userId }).sort({ createdAt: -1 }).limit(120);

export const updateNote = async (userId, noteId, payload) => {
  const update = {};

  if (Object.prototype.hasOwnProperty.call(payload, "title")) {
    update.title = String(payload.title || "").trim();
    if (!update.title) {
      throw new HttpError(400, "Kundalik sarlavhasi bo'sh bo'lmasin");
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, "body")) {
    update.body = String(payload.body || "").trim();
  }

  const note = await Note.findOneAndUpdate({ _id: noteId, user: userId }, update, {
    new: true,
    runValidators: true
  });

  if (!note) {
    throw new HttpError(404, "Kundalik topilmadi");
  }

  return note;
};

export const deleteNote = async (userId, noteId) => {
  const note = await Note.findOneAndDelete({ _id: noteId, user: userId });
  if (!note) {
    throw new HttpError(404, "Kundalik topilmadi");
  }

  return note;
};
