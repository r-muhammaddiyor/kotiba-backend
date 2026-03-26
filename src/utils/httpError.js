export class HttpError extends Error {
  constructor(statusCode, message, meta = null) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.meta = meta;
  }
}
