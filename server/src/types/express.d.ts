declare global {
  namespace Express {
    interface Request {
      sdk: any;
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
