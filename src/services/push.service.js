import webpush from "web-push";
import { env } from "../config/env.js";
import { PushSubscription } from "../models/PushSubscription.js";
import { HttpError } from "../utils/httpError.js";

const canUseWebPush = Boolean(env.vapidPublicKey && env.vapidPrivateKey);

if (canUseWebPush) {
  webpush.setVapidDetails(env.vapidSubject, env.vapidPublicKey, env.vapidPrivateKey);
}

export const saveSubscription = async (userId, subscription, userAgent = "") => {
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    throw new HttpError(400, "Invalid push subscription payload");
  }

  const doc = await PushSubscription.findOneAndUpdate(
    { user: userId, endpoint: subscription.endpoint },
    {
      user: userId,
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth
      },
      userAgent
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  );

  return doc;
};

export const sendPushToUser = async (userId, payload) => {
  if (!canUseWebPush) {
    return {
      sent: 0,
      failed: 0,
      skipped: true,
      skippedReason: "web-push-not-configured",
      subscriptionCount: 0
    };
  }

  const subscriptions = await PushSubscription.find({ user: userId }).lean();

  if (!subscriptions.length) {
    return {
      sent: 0,
      failed: 0,
      skipped: true,
      skippedReason: "no-active-subscriptions",
      subscriptionCount: 0
    };
  }

  let sent = 0;
  let failed = 0;

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(sub, JSON.stringify(payload));
      sent += 1;
    } catch (error) {
      failed += 1;
      const statusCode = error?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await PushSubscription.deleteOne({ endpoint: sub.endpoint });
      }
    }
  }

  return {
    sent,
    failed,
    skipped: false,
    skippedReason: null,
    subscriptionCount: subscriptions.length
  };
};

export const getVapidPublicKey = () => env.vapidPublicKey;
