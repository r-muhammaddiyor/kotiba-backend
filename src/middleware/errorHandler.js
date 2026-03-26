import { HttpError } from "../utils/httpError.js";

export const errorHandler = (err, req, res, next) => {
  if (err instanceof HttpError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      meta: err.meta
    });
  }

  if (err.name === "MulterError") {
    return res.status(400).json({
      success: false,
      message: `Upload error: ${err.message}`
    });
  }

  console.error("Unhandled error", err);

  return res.status(500).json({
    success: false,
    message: "Serverda kutilmagan xatolik yuz berdi"
  });
};
