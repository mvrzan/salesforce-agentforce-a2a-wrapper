import { v4 as uuidv4 } from "uuid";
import type { Message } from "@a2a-js/sdk";
import type { AgentExecutor, RequestContext, ExecutionEventBus } from "@a2a-js/sdk/server";
import { getCurrentTimestamp } from "../utils/loggingUtil.ts";
import salesforceSdk from "@heroku/applink";

export class FinancialAgentExecutor implements AgentExecutor {
  async execute(requestContext: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
    let sessionId: string | null = null;

    try {
      // Extract the user's message from the request context
      const userMessage = requestContext.userMessage;
      const userText = userMessage?.parts?.find((part) => part.kind === "text")?.text || "";

      console.log(`${getCurrentTimestamp()} 🤖 - FinancialAgentExecutor - Processing A2A request: ${userText}`);

      // Initialize Salesforce SDK and get authorization
      const sdk = salesforceSdk.init();
      const auth = await sdk.addons.applink.getAuthorization("AFMatija");
      const accessToken = auth.accessToken;
      const instanceUrl = auth.domainUrl;
      const agentId = process.env.AGENTFORCE_AGENT_ID;

      // Generate a unique external session key
      const externalSessionKey = uuidv4();

      // Step 1: Start Agentforce session
      console.log(`${getCurrentTimestamp()} 🚀 - FinancialAgentExecutor - Starting Agentforce session...`);

      const startSessionBody = {
        externalSessionKey,
        instanceConfig: {
          endpoint: instanceUrl,
        },
        streamingCapabilities: {
          chunkTypes: ["Text"],
        },
        bypassUser: true,
      };

      const startSessionResponse = await fetch(
        `https://api.salesforce.com/einstein/ai-agent/v1/agents/${agentId}/sessions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(startSessionBody),
        },
      );

      if (!startSessionResponse.ok) {
        const errorText = await startSessionResponse.text();
        throw new Error(`Failed to start Agentforce session: ${startSessionResponse.statusText} - ${errorText}`);
      }

      const sessionData = await startSessionResponse.json();
      sessionId = sessionData.sessionId;

      console.log(`${getCurrentTimestamp()} ✅ - FinancialAgentExecutor - Session started: ${sessionId}`);

      // Step 2: Send message to Agentforce (non-streaming for simplicity)
      console.log(`${getCurrentTimestamp()} 📤 - FinancialAgentExecutor - Sending message to Agentforce...`);

      const sendMessageBody = {
        message: {
          sequenceId: 1,
          type: "Text",
          text: userText,
        },
      };

      const sendMessageResponse = await fetch(
        `https://api.salesforce.com/einstein/ai-agent/v1/sessions/${sessionId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(sendMessageBody),
        },
      );

      if (!sendMessageResponse.ok) {
        const errorText = await sendMessageResponse.text();
        throw new Error(`Failed to send message to Agentforce: ${sendMessageResponse.statusText} - ${errorText}`);
      }

      const messageData = await sendMessageResponse.json();

      console.log(`${getCurrentTimestamp()} 📥 - FinancialAgentExecutor - Received response from Agentforce`);

      // Extract text from Agentforce response
      const agentforceText =
        messageData.messages
          ?.filter((msg: any) => msg.role === "Agent")
          ?.map((msg: any) => msg.message?.text || "")
          ?.join(" ") || "No response from Agentforce";

      // Step 3: Delete the session
      console.log(`${getCurrentTimestamp()} 🗑️ - FinancialAgentExecutor - Deleting Agentforce session...`);

      await fetch(`https://api.salesforce.com/einstein/ai-agent/v1/sessions/${sessionId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "x-session-end-reason": "UserRequest",
        },
      });

      console.log(`${getCurrentTimestamp()} ✅ - FinancialAgentExecutor - Session deleted`);

      // Create A2A response message
      const responseMessage: Message = {
        kind: "message",
        messageId: uuidv4(),
        role: "agent",
        parts: [{ kind: "text", text: agentforceText }],
        contextId: requestContext.contextId,
      };

      // Publish the message and signal that the interaction is finished
      eventBus.publish(responseMessage);
      eventBus.finished();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`${getCurrentTimestamp()} ❌ - FinancialAgentExecutor - Error:`, errorMessage);

      // Attempt to clean up session if it was created
      if (sessionId) {
        try {
          const sdk = salesforceSdk.init();
          const auth = await sdk.addons.applink.getAuthorization("AFMatija");
          await fetch(`https://api.salesforce.com/einstein/ai-agent/v1/sessions/${sessionId}`, {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${auth.accessToken}`,
              "x-session-end-reason": "Error",
            },
          });
          console.log(`${getCurrentTimestamp()} 🧹 - FinancialAgentExecutor - Cleaned up session after error`);
        } catch (cleanupError) {
          console.error(`${getCurrentTimestamp()} ⚠️ - FinancialAgentExecutor - Failed to cleanup session`);
        }
      }

      const responseMessage: Message = {
        kind: "message",
        messageId: uuidv4(),
        role: "agent",
        parts: [{ kind: "text", text: `Sorry, I encountered an error: ${errorMessage}` }],
        contextId: requestContext.contextId,
      };

      eventBus.publish(responseMessage);
      eventBus.finished();
    }
  }

  cancelTask = async (): Promise<void> => {};
}
