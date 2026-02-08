import express from "express";
import streamOrchestratorChat from "../controllers/streamOrchestratorChat.ts";

const router = express.Router();

router.post("/api/orchestrator/chat", streamOrchestratorChat);

export default router;
