import { Router } from "express";
import startSession from "../controllers/startSession.ts";
import deleteSession from "../controllers/deleteSession.ts";

const agentforceApiRoutes = Router();

agentforceApiRoutes.post("/api/v1/af/sessions/:sessionId", startSession);
agentforceApiRoutes.delete("/api/v1/delete-session", deleteSession);

export default agentforceApiRoutes;
