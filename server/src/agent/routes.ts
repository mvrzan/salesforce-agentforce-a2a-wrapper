import type { Express } from "express";
import { AGENT_CARD_PATH } from "@a2a-js/sdk";
import { DefaultRequestHandler, InMemoryTaskStore } from "@a2a-js/sdk/server";
import { agentCardHandler, jsonRpcHandler, restHandler, UserBuilder } from "@a2a-js/sdk/server/express";
import { createAgentCard } from "./card.ts";
import { FinancialAgentExecutor } from "./executor.ts";

export function setupAgentRoutes(app: Express, baseUrl: string): void {
  // Create agent components
  const agentCard = createAgentCard(baseUrl);
  const agentExecutor = new FinancialAgentExecutor();
  const requestHandler = new DefaultRequestHandler(agentCard, new InMemoryTaskStore(), agentExecutor);

  // Setup A2A protocol routes
  app.use(`/${AGENT_CARD_PATH}`, agentCardHandler({ agentCardProvider: requestHandler }));
  app.use("/a2a/jsonrpc", jsonRpcHandler({ requestHandler, userBuilder: UserBuilder.noAuthentication }));
  app.use("/a2a/rest", restHandler({ requestHandler, userBuilder: UserBuilder.noAuthentication }));
}
