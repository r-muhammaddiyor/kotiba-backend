import { ensureRuntimeReady } from "./runtime.js";

export default async function handler(req, res) {
  const app = await ensureRuntimeReady();
  return app(req, res);
}
