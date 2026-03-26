import { getDashboardSummary } from "../services/dashboard.service.js";

export const getDashboard = async (req, res, next) => {
  try {
    const summary = await getDashboardSummary(req.auth.userId);
    res.json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
};
