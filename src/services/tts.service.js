import axios from "axios";
import { env } from "../config/env.js";
import { HttpError } from "../utils/httpError.js";

const extractRemoteAudioUrl = (payload) =>
  payload?.result?.url ??
  payload?.url ??
  payload?.audio_url ??
  payload?.audioUrl ??
  null;

const parseJsonBuffer = (buffer) => {
  try {
    return JSON.parse(Buffer.from(buffer).toString("utf8"));
  } catch {
    return null;
  }
};

export const synthesizeUzbekSpeech = async (text) => {
  if (!env.uzbekVoiceTtsUrl) {
    throw new HttpError(500, "UZBEKVOICE_TTS_URL sozlanmagan");
  }

  try {
    const { data, headers } = await axios.post(
      env.uzbekVoiceTtsUrl,
      {
        text,
        model: env.uzbekVoiceTtsModel,
        blocking: "true"
      },
      {
        headers: {
          Authorization: env.uzbekVoiceApiKey,
          "Content-Type": "application/json"
        },
        responseType: "arraybuffer",
        timeout: 45000
      }
    );

    if (!data) {
      throw new HttpError(502, "TTS bo'sh audio qaytardi");
    }

    const contentType = headers["content-type"] || "application/octet-stream";

    if (!contentType.includes("application/json")) {
      return {
        mimeType: contentType,
        audioBase64: Buffer.from(data).toString("base64")
      };
    }

    const jsonPayload = parseJsonBuffer(data);
    const audioUrl = extractRemoteAudioUrl(jsonPayload);

    if (!audioUrl) {
      throw new HttpError(502, "TTS JSON javobidan audio URL topilmadi", jsonPayload);
    }

    const audioResponse = await axios.get(audioUrl, {
      responseType: "arraybuffer",
      timeout: 45000
    });

    return {
      mimeType: audioResponse.headers["content-type"] || "audio/wav",
      audioBase64: Buffer.from(audioResponse.data).toString("base64")
    };
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    throw new HttpError(502, "TTS servisida xatolik", {
      details: error?.response?.data ?? error.message
    });
  }
};
