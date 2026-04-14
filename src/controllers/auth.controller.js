import {
  getSafeUser,
  loginUser,
  loginWithGoogle,
  sendLoginOtp,
  registerUser,
  verifyLoginOtp,
  updateUserProfile
} from "../services/auth.service.js";
import { env } from "../config/env.js";

export const register = async (req, res, next) => {
  try {
    const result = await registerUser(req.body ?? {});
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const result = await loginUser(req.body ?? {});
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const google = async (req, res, next) => {
  try {
    const result = await loginWithGoogle(req.body ?? {});
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const sendOtp = async (req, res, next) => {
  try {
    const result = await sendLoginOtp(req.body ?? {});
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const verifyOtp = async (req, res, next) => {
  try {
    const result = await verifyLoginOtp(req.body ?? {});
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const config = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: {
        googleAvailable: env.googleClientIds.length > 0,
        googleServerClientId: env.googleClientIds[0] ?? "",
        googleClientIds: env.googleClientIds
      }
    });
  } catch (error) {
    next(error);
  }
};

export const me = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: {
        user: getSafeUser(req.user)
      }
    });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const user = await updateUserProfile(req.auth.userId, req.body ?? {});
    res.json({
      success: true,
      data: {
        user
      }
    });
  } catch (error) {
    next(error);
  }
};
