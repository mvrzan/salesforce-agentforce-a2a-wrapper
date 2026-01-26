import express, { type Request, type Response } from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { AgentCard, Message, AGENT_CARD_PATH } from "@a2a-js/sdk";
import agentActionRoutes from "./routes/agentActions.ts";
import agentforceApiRoutes from "./routes/agentforceApi.ts";
import { getCurrentTimestamp } from "./utils/loggingUtil.ts";

const app = express();
const port = process.env.APP_PORT || process.env.PORT || 3000;
const baseUrl = process.env.APP_URL || `http://localhost:${port}`;

// A2A Agent Card
const agentforceAgent: AgentCard = {
  name: "Agentforce Financial Agent",
  description:
    "A financial AI agent that provides real-time stock market data including stock prices and company profiles, as well as Salesforce quarterly earning report data.",
  protocolVersion: "0.3.0",
  version: "0.1.0",
  url: `${baseUrl}/a2a/jsonrpc`,
  skills: [
    {
      id: "stock-price",
      name: "Get Stock Price",
      description: "Retrieve real-time stock price and trading data for any stock symbol",
      tags: ["finance", "stocks", "market-data"],
    },
    {
      id: "company-profile",
      name: "Get Company Profile",
      description: "Get detailed company information including market cap, industry, and exchange data",
      tags: ["finance", "company", "market-data"],
    },
    {
      id: "earnings-report",
      name: "Salesforce Earnings",
      description: "Access Salesforce quarterly earning report data and financial metrics",
      tags: ["finance", "salesforce", "earnings"],
    },
  ],
  capabilities: {
    pushNotifications: false,
  },
  defaultInputModes: ["text"],
  defaultOutputModes: ["text"],
  additionalInterfaces: [
    { url: `${baseUrl}/a2a/jsonrpc`, transport: "JSONRPC" }, // Default JSON-RPC transport
    { url: `${baseUrl}/a2a/rest`, transport: "HTTP+JSON" }, // HTTP+JSON/REST transport
  ],
};

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  }),
);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(agentActionRoutes);
app.use(agentforceApiRoutes);
app.use(express.static("public"));

app.get("/test", (req: Request, res: Response) => {
  console.log("Calling your endpoint!");

  res.status(200).json({
    message: "It works!",
  });
});

app.listen(port, () => {
  console.log(`${getCurrentTimestamp()} - 🎬 index - Authentication server listening on port: ${port}`);
});
