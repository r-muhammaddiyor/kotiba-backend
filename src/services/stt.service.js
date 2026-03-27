import axios from "axios";
import FormData from "form-data";
import { env } from "../config/env.js";
import { HttpError } from "../utils/httpError.js";
import { normalizeUzbekVoiceUrl } from "../utils/uzbekVoiceUrl.js";

export const transcribeUzbekAudio = async (audioBuffer, filename, mimeType) => {
  const sttUrl = normalizeUzbekVoiceUrl(env.uzbekVoiceSttUrl);

  if (!sttUrl) {
    throw new HttpError(500, "UZBEKVOICE_STT_URL sozlanmagan");
  }

  const formData = new FormData();
  formData.append("file", audioBuffer, {
    filename: filename ?? "voice.webm",
    contentType: mimeType ?? "audio/webm"
  });
  formData.append("return_offsets", "false");
  formData.append("run_diarization", "false");
  formData.append("language", "uz");
  formData.append("blocking", "true");

  try {
    const { data } = await axios.post(sttUrl, formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: env.uzbekVoiceApiKey
      },
      timeout: 45000
    });

    const text =
      data?.result?.text ??
      data?.text ??
      data?.transcript ??
      data?.result?.conversation_text ??
      "";
    if (!text) {
      throw new HttpError(502, "STT javobi bo'sh qaytdi", data);
    }

    return text.replace(/Speaker\\s+\\d+:\\s*/gi, "").trim();
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    throw new HttpError(502, "STT servisida xatolik", {
      details: error?.response?.data ?? error.message
    });
  }
};
