import type { Express } from "express";
import { AGENT_CARD_PATH } from "@a2a-js/sdk";
import { DefaultRequestHandler, InMemoryTaskStore } from "@a2a-js/sdk/server";
import { agentCardHandler, jsonRpcHandler, restHandler, UserBuilder } from "@a2a-js/sdk/server/express";
import { createAgentCard } from "./card.ts";
import { FinancialAgentExecutor } from "./executor.ts";
import { getCurrentTimestamp } from "../utils/loggingUtil.ts";

export function setupAgentRoutes(app: Express, baseUrl: string): void {
  // Create agent components
  const agentCard = createAgentCard(baseUrl);
  const agentExecutor = new FinancialAgentExecutor();
  const requestHandler = new DefaultRequestHandler(agentCard, new InMemoryTaskStore(), agentExecutor);

  // Setup A2A protocol routes with logging
  app.use(
    `/${AGENT_CARD_PATH}`,
    (req, _res, next) => {
      console.log(`${getCurrentTimestamp()} 📋 - Agent Card requested: ${req.method} ${req.path}`);
      next();
    },
    agentCardHandler({ agentCardProvider: requestHandler }),
  );

  app.use(
    "/a2a/jsonrpc",
    (req, _res, next) => {
      console.log(`${getCurrentTimestamp()} 🔌 - JSON-RPC request: ${req.method} ${req.path}`);
      next();
    },
    jsonRpcHandler({ requestHandler, userBuilder: UserBuilder.noAuthentication }),
  );

  app.use(
    "/a2a/rest",
    (req, _res, next) => {
      console.log(`${getCurrentTimestamp()} 🌐 - REST request: ${req.method} ${req.path}`);
      next();
    },
    restHandler({ requestHandler, userBuilder: UserBuilder.noAuthentication }),
  );
}
