import type { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import type { Message } from "@a2a-js/sdk";
import type { AgentExecutor, RequestContext, ExecutionEventBus } from "@a2a-js/sdk/server";
import { getCurrentTimestamp } from "../utils/loggingUtil.ts";
import getStockPrice from "../controllers/getStockPrice.ts";
import getCompanyProfile from "../controllers/getCompanyProfile.ts";
import type { StockPriceData, CompanyProfileData } from "./types.ts";

export class FinancialAgentExecutor implements AgentExecutor {
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
