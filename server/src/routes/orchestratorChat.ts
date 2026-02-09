import express from "express";
import streamOrchestratorChat from "../controllers/streamOrchestratorChat.ts";
import { validateSignature } from "../middleware/validateSignature.ts";

const router = express.Router();

router.post("/api/orchestrator/chat", validateSignature, streamOrchestratorChat);

export default router;
