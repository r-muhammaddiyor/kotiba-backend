import { Router } from "express";
import {
  config,
  google,
  login,
  me,
  register,
  sendOtp,
  updateProfile,
  verifyOtp
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.js";

const authRouter = Router();

authRouter.get("/config", config);
authRouter.post("/register", register);
authRouter.post("/login", login);
authRouter.post("/google", google);
authRouter.post("/send-otp", sendOtp);
authRouter.post("/verify-otp", verifyOtp);
authRouter.get("/me", requireAuth, me);
authRouter.patch("/profile", requireAuth, updateProfile);

export default authRouter;
