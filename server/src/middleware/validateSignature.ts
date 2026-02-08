import { type Request, type Response, type NextFunction } from "express";
import crypto from "crypto";
import { getCurrentTimestamp } from "../utils/loggingUtil.ts";

export function validateSignature(req: Request, res: Response, next: NextFunction) {
  console.log(`${getCurrentTimestamp()} 🕵️‍♀️ - middleware - Request received...`);

  const secret = process.env.API_SECRET;
  const path = req.originalUrl || req.url;
  const requestMethod = req.method;

  if (!secret) {
    console.error(`${getCurrentTimestamp()} ❌ - middleware - API_SECRET not configured in environment`);

    return res.status(500).json({ error: "Server configuration error" });
  }

  const timestamp = req.headers["x-timestamp"];
  const receivedSignature = req.headers["x-signature"];

  if (!timestamp || !receivedSignature || Array.isArray(timestamp) || Array.isArray(receivedSignature)) {
    console.error(`${getCurrentTimestamp()} ❌ - middleware - Missing authentication headers`);

    return res.status(401).json({ error: "Missing authentication headers" });
  }

  const now = Date.now();
  const requestTime = parseInt(timestamp, 10);
  const timeDiff = Math.abs(now - requestTime);

  if (timeDiff > 300000) {
    console.error(`${getCurrentTimestamp()} ❌ - middleware - Request timestamp expired. Time diff: ${timeDiff}ms`);

    return res.status(401).json({ error: "Request expired" });
  }

  const message = `${timestamp}${requestMethod.toUpperCase()}${path}`;
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(message);
  const expectedSignature = hmac.digest("hex");

  if (receivedSignature !== expectedSignature) {
    console.log(`${getCurrentTimestamp()} ❌ - middleware - Invalid signature!`);
    console.log(`${getCurrentTimestamp()} 🤔 - middleware - Expected`, expectedSignature);
    console.log(`${getCurrentTimestamp()} 🤔 - middleware - Received`, receivedSignature);
    console.log(`${getCurrentTimestamp()} 🤔 - middleware - Message`, message);

    return res.status(401).json({ error: "Invalid signature" });
  }

  console.log(`${getCurrentTimestamp()} ✅ - middleware - Request signature validated!`);
  next();
}
