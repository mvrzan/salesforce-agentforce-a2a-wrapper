import { type Request, type Response } from "express";
import { getCurrentTimestamp } from "../utils/loggingUtil.ts";
import salesforceSdk from "@heroku/applink";

const deleteSession = async (req: Request, res: Response) => {
  try {
    console.log(`${getCurrentTimestamp()} 📥 - deleteSession - Request received...`);

    const connectionName = process.env.APP_LINK_CONNECTION_NAME;
    const sdk = salesforceSdk.init();
    const auth = await sdk.addons.applink.getAuthorization(connectionName);
    const accessToken = auth.accessToken;
    const sessionId = req.body.sessionId;

    console.log(`${getCurrentTimestamp()} 🗑️ - deleteSession - Session: ${sessionId}`);

    const config = {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "x-session-end-reason": "UserRequest",
      },
    };

    console.log(`${getCurrentTimestamp()} 🤖 - deleteSession - Sending Agentforce message...`);

    const response = await fetch(`https://api.salesforce.com/einstein/ai-agent/v1/sessions/${sessionId}`, config);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `${getCurrentTimestamp()} ❌ - deleteSession - API Error: ${response.status} ${response.statusText}`,
      );
      console.error(`${getCurrentTimestamp()} ❌ - deleteSession - Response: ${errorText}`);
      throw new Error(`There was an error while deleting the Agentforce session: ${response.statusText}`);
    }

    console.log(`${getCurrentTimestamp()} ✅ - deleteSession - Agentforce session deleted!`);

    res.status(200).json({
      message: "Session successfully ended.",
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(`${getCurrentTimestamp()} ❌ - deleteSession - Error occurred: ${errorMessage}`);
    res.status(500).json({
      message: errorMessage,
    });
  }
};

export default deleteSession;
