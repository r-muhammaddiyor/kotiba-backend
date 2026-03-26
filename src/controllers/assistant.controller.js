import { generateAssistantReply } from "../services/assistant.service.js";

export const handleAssistantText = async (req, res, next) => {
  try {
    const { text, includeAudio = true } = req.body ?? {};

    const assistantResponse = await generateAssistantReply({
      userId: req.auth.userId,
      userText: text,
      includeAudio: Boolean(includeAudio),
      interactionType: "text"
    });

    res.status(200).json({
      success: true,
      data: assistantResponse
    });
  } catch (error) {
    next(error);
  }
};
