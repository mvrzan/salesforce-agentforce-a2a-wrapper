import { Router } from "express";
import startSession from "../controllers/startSession.ts";
import deleteSession from "../controllers/deleteSession.ts";
import { validateSignature } from "../middleware/validateSignature.ts";
import sendStreamingMessage from "../controllers/sendStreamingMessage.ts";

const agentforceApiRoutes = Router();

agentforceApiRoutes.post("/api/v1/af/sessions/:sessionId", validateSignature, startSession);
agentforceApiRoutes.delete("/api/v1/delete-session", validateSignature, deleteSession);
agentforceApiRoutes.post("/api/v1/send-streaming-message", validateSignature, sendStreamingMessage);

export default agentforceApiRoutes;
