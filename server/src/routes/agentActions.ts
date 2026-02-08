import { Router } from "express";
import initSalesforceSdk from "../middleware/herokuServiceMesh.ts";
import { getCurrentTimestamp } from "../utils/loggingUtil.ts";
import getStockPrice from "../controllers/getStockPrice.ts";
import getCompanyProfile from "../controllers/getCompanyProfile.ts";

const agentActionRoutes = Router();

const initHerokuMiddleware = async () => {
  try {
    console.log(`${getCurrentTimestamp()} 🔧 - Initializing Agent Action routes...`);
    const { salesforceMiddleware, withSalesforceConfig } = await initSalesforceSdk();

    agentActionRoutes.get(
      "/api/v1/stocks/:symbol",
      withSalesforceConfig({ parseRequest: true }),
      salesforceMiddleware,
      getStockPrice,
    );

    agentActionRoutes.get(
      "/api/v1/profile/:symbol",
      withSalesforceConfig({ parseRequest: true }),
      salesforceMiddleware,
      getCompanyProfile,
    );

    console.log(`${getCurrentTimestamp()} ✅ - agentActions - Agent Action routes registered successfully!`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${getCurrentTimestamp()} ❌ - agentActions -Failed to initialize Agent Action routes: ${message}`);
  }
};

await initHerokuMiddleware();

export default agentActionRoutes;
