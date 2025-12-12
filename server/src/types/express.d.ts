import { SalesforceSDK } from "@heroku/applink";

declare global {
  namespace Express {
    interface Request {
      sdk: SalesforceSDK;
      log?: any;
    }

    interface Route {
      salesforceConfig?: {
        parseRequest?: boolean;
        [key: string]: any;
      };
    }
  }
}

export {};
