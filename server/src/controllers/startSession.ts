import { type Request, type Response } from "express";
import { getCurrentTimestamp } from "../utils/loggingUtil.ts";
import salesforceSdk from "@heroku/applink";

const startSession = async (req: Request, res: Response) => {
  try {
    console.log(`${getCurrentTimestamp()} 📥 - startSession - Request received...`);

    const connectionName = process.env.APP_LINK_CONNECTION_NAME;
    const sdk = salesforceSdk.init();
    const auth = await sdk.addons.applink.getAuthorization(connectionName);
    const accessToken = auth.accessToken;
    const instanceUrl = auth.domainUrl;
    const sessionId = req.params.sessionId;

    console.log(`${getCurrentTimestamp()} 🔑 - startSession - Using session ID: ${sessionId}`);

    const agentId = process.env.AGENTFORCE_AGENT_ID;

    const body = {
      externalSessionKey: sessionId,
      instanceConfig: {
        endpoint: instanceUrl,
      },
      streamingCapabilities: {
        chunkTypes: ["Text"],
      },
      bypassUser: true,
    };

    const config = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    };

    console.log(`${getCurrentTimestamp()} 🤖 - startSession - Starting Agentforce session...`);

    const response = await fetch(`https://api.salesforce.com/einstein/ai-agent/v1/agents/${agentId}/sessions`, config);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `${getCurrentTimestamp()} ❌ - startSession - API Error: ${response.status} ${response.statusText}`,
      );
      console.error(`${getCurrentTimestamp()} ❌ - startSession - Response: ${errorText}`);
      throw new Error(`There was an error while getting the Agentforce messages: ${response.statusText}`);
    }

    const data = await response.json();

    console.log(`${getCurrentTimestamp()} ✅ - startSession - Agentforce session started!`);
    console.log(`${getCurrentTimestamp()} 🔑 - startSession - Session ID from Agentforce: ${data.sessionId}`);

    res.status(200).json({
      sessionId: data.sessionId,
      messages: data.messages,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(`${getCurrentTimestamp()} ❌ - startSession - Error occurred: ${errorMessage}`);

    res.status(500).json({
      success: false,
      error: "Failed to start Agentforce session",
      message: errorMessage,
    });
  }
};

export default startSession;
