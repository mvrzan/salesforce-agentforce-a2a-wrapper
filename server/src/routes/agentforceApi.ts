import { Router } from "express";
import startSession from "../controllers/startSession.ts";
import deleteSession from "../controllers/deleteSession.ts";
import sendStreamingMessage from "../controllers/sendStreamingMessage.ts";

const agentforceApiRoutes = Router();

agentforceApiRoutes.post("/api/v1/af/sessions/:sessionId", startSession);
agentforceApiRoutes.delete("/api/v1/delete-session", deleteSession);
agentforceApiRoutes.post("/api/v1/send-streaming-message", sendStreamingMessage);

export default agentforceApiRoutes;
