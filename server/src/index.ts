import express, { type Request, type Response } from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import { AgentCard, Message, AGENT_CARD_PATH } from "@a2a-js/sdk";
import {
  AgentExecutor,
  RequestContext,
  ExecutionEventBus,
  DefaultRequestHandler,
  InMemoryTaskStore,
} from "@a2a-js/sdk/server";
import { agentCardHandler, jsonRpcHandler, restHandler, UserBuilder } from "@a2a-js/sdk/server/express";
import agentActionRoutes from "./routes/agentActions.ts";
import agentforceApiRoutes from "./routes/agentforceApi.ts";
import { getCurrentTimestamp } from "./utils/loggingUtil.ts";
import getStockPrice from "./controllers/getStockPrice.ts";
import getCompanyProfile from "./controllers/getCompanyProfile.ts";

interface StockPriceData {
  success: boolean;
  data?: {
    symbol: string;
    price: number;
    metadata: {
      high: number;
      low: number;
      open: number;
      previousClose: number;
      change: number;
      changePercent: number;
      timestamp: number;
    };
  };
  error?: string;
}

interface CompanyProfileData {
  success: boolean;
  data?: {
    symbol: string;
    name: string;
    country: string;
    currency: string;
    exchange: string;
    industry: string;
    ipo: string;
    marketCapitalization: number;
    sharesOutstanding: number;
    logo: string;
    phone: string;
    weburl: string;
  };
  error?: string;
}

const app = express();
const port = process.env.APP_PORT || process.env.PORT || 3000;
const baseUrl = process.env.APP_URL || `http://localhost:${port}`;

// A2A Agent Card
const agentforceAgentCard: AgentCard = {
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
    { url: `${baseUrl}/a2a/jsonrpc`, transport: "JSONRPC" },
    { url: `${baseUrl}/a2a/rest`, transport: "HTTP+JSON" },
  ],
};

// Agent Logic
class FinancialAgentExecutor implements AgentExecutor {
  async execute(requestContext: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
    try {
      // Extract the user's message from the request context
      const userMessage = requestContext.userMessage;
      const userText = userMessage?.parts?.find((part) => part.kind === "text")?.text || "";

      console.log(`${getCurrentTimestamp()} 🤖 - FinancialAgentExecutor - Processing request: ${userText}`);

      // Determine which skill to execute based on the request
      let responseText = "";

      if (userText.toLowerCase().includes("price") || userText.toLowerCase().includes("quote")) {
        // Extract stock symbol from the message (simple implementation)
        const symbolMatch = userText.match(/\b([A-Z]{1,5})\b/);
        const symbol = symbolMatch ? symbolMatch[1] : "CRM";

        // Create mock request/response objects to call the controller
        const mockReq = { params: { symbol } } as Partial<Request> as Request;
        let data: StockPriceData | undefined;
        const mockRes = {
          status: (_code: number) => ({
            json: (body: StockPriceData) => {
              data = body;
            },
          }),
        } as unknown as Response;

        await getStockPrice(mockReq, mockRes);

        if (data?.success && data.data) {
          responseText =
            `The current stock price for ${data.data.symbol} is $${data.data.price}. ` +
            `It opened at $${data.data.metadata.open}, with a high of $${data.data.metadata.high} and low of $${data.data.metadata.low}. ` +
            `The change is ${data.data.metadata.change > 0 ? "+" : ""}${data.data.metadata.change} (${data.data.metadata.changePercent}%).`;
        } else {
          responseText = `Sorry, I couldn't retrieve the stock price. ${data?.error}`;
        }
      } else if (userText.toLowerCase().includes("profile") || userText.toLowerCase().includes("company")) {
        const symbolMatch = userText.match(/\b([A-Z]{1,5})\b/);
        const symbol = symbolMatch ? symbolMatch[1] : "AAPL";

        // Create mock request/response objects to call the controller
        const mockReq = { params: { symbol } } as Partial<Request> as Request;
        let data: CompanyProfileData | undefined;
        const mockRes = {
          status: (_code: number) => ({
            json: (body: CompanyProfileData) => {
              data = body;
            },
          }),
        } as unknown as Response;

        await getCompanyProfile(mockReq, mockRes);

        if (data?.success && data.data) {
          responseText =
            `${data.data.name} (${data.data.symbol}) is a ${data.data.industry} company based in ${data.data.country}. ` +
            `It trades on ${data.data.exchange} with a market cap of $${(data.data.marketCapitalization / 1000).toFixed(2)}B. ` +
            `IPO Date: ${data.data.ipo}. Website: ${data.data.weburl}`;
        } else {
          responseText = `Sorry, I couldn't retrieve the company profile. ${data?.error}`;
        }
      } else {
        responseText = `I'm a financial AI agent. I can help you with stock prices and company profiles. Try asking "What's the price of CRM?" or "Tell me about CRM company profile."`;
      }

      // Create a direct message response
      const responseMessage: Message = {
        kind: "message",
        messageId: uuidv4(),
        role: "agent",
        parts: [{ kind: "text", text: responseText }],
        contextId: requestContext.contextId,
      };

      // Publish the message and signal that the interaction is finished
      eventBus.publish(responseMessage);
      eventBus.finished();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`${getCurrentTimestamp()} ❌ - FinancialAgentExecutor - Error:`, errorMessage);

      const responseMessage: Message = {
        kind: "message",
        messageId: uuidv4(),
        role: "agent",
        parts: [{ kind: "text", text: `Sorry, I encountered an error: ${errorMessage}` }],
        contextId: requestContext.contextId,
      };

      eventBus.publish(responseMessage);
      eventBus.finished();
    }
  }

  cancelTask = async (): Promise<void> => {};
}

const agentExecutor = new FinancialAgentExecutor();
const requestHandler = new DefaultRequestHandler(agentforceAgentCard, new InMemoryTaskStore(), agentExecutor);

app.use(`/${AGENT_CARD_PATH}`, agentCardHandler({ agentCardProvider: requestHandler }));
app.use("/a2a/jsonrpc", jsonRpcHandler({ requestHandler, userBuilder: UserBuilder.noAuthentication }));
app.use("/a2a/rest", restHandler({ requestHandler, userBuilder: UserBuilder.noAuthentication }));

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

app.listen(port, () => {
  console.log(`${getCurrentTimestamp()} - 🎬 index - Authentication server listening on port: ${port}`);
});
