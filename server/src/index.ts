import express, { type Request, type Response } from "express";
import bodyParser from "body-parser";
import cors from "cors";
import agentActionRoutes from "./routes/agentActions.ts";
import agentforceApiRoutes from "./routes/agentforceApi.ts";
import orchestratorChatRoutes from "./routes/orchestratorChat.ts";
import { getCurrentTimestamp } from "./utils/loggingUtil.ts";
import { setupAgentRoutes } from "./routes/a2aRoutes.ts";

const app = express();
const port = process.env.APP_PORT || process.env.PORT || 3000;
const baseUrl = process.env.APP_URL || `http://localhost:${port}`;

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  }),
);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

setupAgentRoutes(app, baseUrl);
app.use(orchestratorChatRoutes);
app.use(agentActionRoutes);
app.use(agentforceApiRoutes);
app.use(express.static("public"));

app.listen(port, () => {
  console.log(`${getCurrentTimestamp()} 🎬 - index - Authentication server listening on port: ${port}`);
});
