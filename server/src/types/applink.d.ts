declare module "@heroku/applink" {
  export interface Authorization {
    access_token: string;
    instance_url: string;
    [key: string]: any;
  }

  export interface SalesforceSDK {
    salesforce: {
      parseRequest: (headers: any, body: any, logger: any) => any;
    };
    asyncComplete?: boolean;
    [key: string]: any;
  }

  export interface ApplinkInstance {
    getAuthorization(name: string): Promise<Authorization>;
    [key: string]: any;
  }

  interface ApplinkConstructor {
    new (): ApplinkInstance;
    init(): SalesforceSDK;
    [key: string]: any;
  }

  const Applink: ApplinkConstructor;

  export default Applink;
}
