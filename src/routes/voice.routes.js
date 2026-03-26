import { Router } from "express";
import { handleSpeakText, handleVoiceMessage, voiceUploadMiddleware } from "../controllers/voice.controller.js";

const voiceRouter = Router();

voiceRouter.post("/speak", handleSpeakText);
voiceRouter.post("/", voiceUploadMiddleware, handleVoiceMessage);

export default voiceRouter;
