import { Router } from "express";
import startSession from "../controllers/startSession.ts";

const agentforceApiRoutes = Router();

agentforceApiRoutes.post("/api/v1/af/sessions/:sessionId", startSession);

export default agentforceApiRoutes;
