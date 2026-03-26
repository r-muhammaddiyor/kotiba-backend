import { getVapidPublicKey, saveSubscription, sendPushToUser } from "../services/push.service.js";
import { HttpError } from "../utils/httpError.js";

export const subscribePush = async (req, res, next) => {
  try {
    const subscription = req.body?.subscription;
    if (!subscription) {
      throw new HttpError(400, "subscription payload required");
    }

    const doc = await saveSubscription(req.auth.userId, subscription, req.get("user-agent") || "");

    res.status(201).json({
      success: true,
      data: {
        id: doc._id,
        endpoint: doc.endpoint
      }
    });
  } catch (error) {
    next(error);
  }
};

export const testPush = async (req, res, next) => {
  try {
    const result = await sendPushToUser(req.auth.userId, {
      title: "AI Secretary",
      body: req.body?.body || "Test push notification",
      url: req.body?.url || "/"
    });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getPushMeta = async (req, res, next) => {
  try {
    const publicKey = getVapidPublicKey();
    if (!publicKey) {
      throw new HttpError(404, "VAPID public key sozlanmagan");
    }

    res.json({
      success: true,
      data: { publicKey }
    });
  } catch (error) {
    next(error);
  }
};
