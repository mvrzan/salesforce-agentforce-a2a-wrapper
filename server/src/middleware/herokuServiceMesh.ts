import { getCurrentTimestamp } from "../utils/loggingUtil.ts";
import salesforceSdk from "@heroku/applink";
import { type Request, type Response, type NextFunction } from "express";

type AsyncHandler = (req: Request, res: Response) => Promise<void>;
const customAsyncHandlers: Record<string, AsyncHandler> = {};

const initSalesforceSdk = async () => {
  console.log(`${getCurrentTimestamp()} 🏋  - herokuServiceMesh - Loading up the middleware...`);

  const salesforceMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    req.sdk = salesforceSdk.init();

    const skipParsing = req.route?.salesforceConfig?.parseRequest === false;

    if (!skipParsing) {
      try {
        const parsedRequest = req.sdk.salesforce.parseRequest(req.headers, req.body, req.log || console);

        req.sdk = Object.assign(req.sdk, parsedRequest);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(
          `${getCurrentTimestamp()} ❌ - herokuServiceMesh  Salesforce authentication error:`,
          errorMessage
        );

        return res.status(401).json({
          error: "Invalid request",
          message: "Missing or invalid Salesforce authentication",
        });
      }
    }
    next();
  };

  const withSalesforceConfig = (options = {}) => {
    return (req: Request, _res: Response, next: NextFunction) => {
      req.route.salesforceConfig = options;
      next();
    };
  };

  const asyncMiddleware = (handler: AsyncHandler) => {
    return async (req: Request, res: Response, next: NextFunction) => {
      console.log(`${getCurrentTimestamp()} 🔄 - herokuServiceMesh  Async response for ${req.method} ${req.path}`);

      const routeKey = `${req.method} ${req.path}`;
      customAsyncHandlers[routeKey] = handler;

      res.status(201).send({
        message: `Async ${routeKey} completed!`,
      });

      try {
        await handler(req, res);
        req.sdk.asyncComplete = true;
        console.log(`${getCurrentTimestamp()} 🔄 Async ${routeKey} completed!`);
      } catch (error) {
        console.error(
          `${getCurrentTimestamp()} ❌ - herokuServiceMesh  Error in async handler for ${routeKey}:`,
          error
        );
      }
      next();
    };
  };

  console.log(`${getCurrentTimestamp()} 🦾 - herokuServiceMesh - Middleware ready!`);

  return {
    salesforceMiddleware,
    asyncMiddleware,
    withSalesforceConfig,
  };
};

export default initSalesforceSdk;
