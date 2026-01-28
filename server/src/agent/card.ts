import type { AgentCard } from "@a2a-js/sdk";

export function createAgentCard(baseUrl: string): AgentCard {
  return {
    name: "Agentforce Financial Agent",
    description:
      "A financial AI agent that provides real-time stock market data including stock prices and company profiles, as well as Salesforce quarterly earning report data.",
    protocolVersion: "0.3.0",
    version: "0.1.0",
    url: `${baseUrl}/a2a/jsonrpc`,
    skills: [
      {
        id: "stock-price",
        name: "Get Stock Price",
        description: "Retrieve real-time stock price and trading data for any stock symbol",
        tags: ["finance", "stocks", "market-data"],
      },
      {
        id: "company-profile",
        name: "Get Company Profile",
        description: "Get detailed company information including market cap, industry, and exchange data",
        tags: ["finance", "company", "market-data"],
      },
      {
        id: "earnings-report",
        name: "Salesforce Earnings",
        description: "Access Salesforce quarterly earning report data and financial metrics",
        tags: ["finance", "salesforce", "earnings"],
      },
    ],
    capabilities: {
      streaming: true,
      pushNotifications: false,
    },
    defaultInputModes: ["text"],
    defaultOutputModes: ["text"],
    additionalInterfaces: [
      { url: `${baseUrl}/a2a/jsonrpc`, transport: "JSONRPC" },
      { url: `${baseUrl}/a2a/rest`, transport: "HTTP+JSON" },
    ],
  };
}
