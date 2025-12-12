declare module "@heroku/applink" {
  export interface SalesforceSDK {
    salesforce: {
      parseRequest: (headers: any, body: any, logger: any) => any;
    };
    asyncComplete?: boolean;
    [key: string]: any;
  }

  export function init(): SalesforceSDK;

  const salesforceSdk: {
    init: typeof init;
  };

  export default salesforceSdk;
}
