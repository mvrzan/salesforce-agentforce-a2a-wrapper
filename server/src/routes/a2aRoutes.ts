import type { Express } from "express";
import { AGENT_CARD_PATH } from "@a2a-js/sdk";
import { DefaultRequestHandler, InMemoryTaskStore } from "@a2a-js/sdk/server";
import { agentCardHandler, jsonRpcHandler, restHandler, UserBuilder } from "@a2a-js/sdk/server/express";
import { createAgentCard } from "../agent/card.ts";
import { FinancialAgentExecutor } from "../agent/executor.ts";
import { getCurrentTimestamp } from "../utils/loggingUtil.ts";

export function setupAgentRoutes(app: Express, baseUrl: string): void {
  const agentCard = createAgentCard(baseUrl);
  const agentExecutor = new FinancialAgentExecutor();
  const requestHandler = new DefaultRequestHandler(agentCard, new InMemoryTaskStore(), agentExecutor);

  app.use(
    `/${AGENT_CARD_PATH}`,
    (req, _res, next) => {
      console.log(`${getCurrentTimestamp()} 📋 - a2aRoutes - Agent Card requested: ${req.method} ${req.path}`);
      next();
    },
    agentCardHandler({ agentCardProvider: requestHandler }),
  );

  app.use(
    "/a2a/jsonrpc",
    (req, _res, next) => {
      console.log(`${getCurrentTimestamp()} 🔌 - a2aRoutes - JSON-RPC request: ${req.method} ${req.path}`);
      next();
    },
    jsonRpcHandler({ requestHandler, userBuilder: UserBuilder.noAuthentication }),
  );

  app.use(
    "/a2a/rest",
    (req, _res, next) => {
      console.log(`${getCurrentTimestamp()} 🌐 - a2aRoutes - REST request: ${req.method} ${req.path}`);
      next();
    },
    restHandler({ requestHandler, userBuilder: UserBuilder.noAuthentication }),
  );
}
