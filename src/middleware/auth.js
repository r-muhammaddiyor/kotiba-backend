import { User } from "../models/User.js";
import { HttpError } from "../utils/httpError.js";
import { verifyAuthToken } from "../utils/token.js";

export const requireAuth = async (req, res, next) => {
  try {
    const header = req.get("authorization") || "";
    const [scheme, token] = header.split(" ");

    if (scheme !== "Bearer" || !token) {
      throw new HttpError(401, "Avtorizatsiya talab qilinadi");
    }

    const payload = verifyAuthToken(token);
    if (!payload?.userId) {
      throw new HttpError(401, "Session yaroqsiz yoki muddati tugagan");
    }

    const user = await User.findById(payload.userId).lean();
    if (!user) {
      throw new HttpError(401, "Foydalanuvchi topilmadi");
    }

    req.auth = {
      userId: String(user._id)
    };
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};
