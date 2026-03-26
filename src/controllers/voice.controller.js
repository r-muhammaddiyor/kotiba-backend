import multer from "multer";
import { processVoicePipeline } from "../services/voicePipeline.service.js";
import { synthesizeUzbekSpeech } from "../services/tts.service.js";
import { HttpError } from "../utils/httpError.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 12 * 1024 * 1024
  }
});

export const voiceUploadMiddleware = upload.single("audio");

export const handleVoiceMessage = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new HttpError(400, "Audio fayl yuborilmadi");
    }

    if (!req.file.mimetype?.startsWith("audio/")) {
      throw new HttpError(400, "Faqat audio fayllar qabul qilinadi");
    }

    const pipelineResponse = await processVoicePipeline({
      userId: req.auth.userId,
      buffer: req.file.buffer,
      filename: req.file.originalname,
      mimeType: req.file.mimetype
    });

    res.status(200).json({
      success: true,
      data: pipelineResponse
    });
  } catch (error) {
    next(error);
  }
};

export const handleSpeakText = async (req, res, next) => {
  try {
    const text = String(req.body?.text ?? "").trim();

    if (!text) {
      throw new HttpError(400, "Ovozga aylantirish uchun matn kerak");
    }

    const audio = await synthesizeUzbekSpeech(text);

    res.status(200).json({
      success: true,
      data: audio
    });
  } catch (error) {
    next(error);
  }
};
