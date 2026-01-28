import { v4 as uuidv4 } from "uuid";
import type { Message, Task, TaskStatus, Artifact, TaskArtifactUpdateEvent } from "@a2a-js/sdk";
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

      const { taskId, contextId, userMessage: reqUserMsg, task } = requestContext;

      // Create initial task if it doesn't exist (following official streaming example)
      if (!task) {
        const initialTask: Task = {
          kind: "task",
          id: taskId,
          contextId: contextId,
          status: {
            state: "submitted",
            timestamp: new Date().toISOString(),
          },
          history: [userMessage],
        };
        eventBus.publish(initialTask);
      }

      // Publish 'working' state
      eventBus.publish({
        kind: "status-update",
        taskId,
        contextId,
        status: { state: "working", timestamp: new Date().toISOString() } as TaskStatus,
        final: false,
      });

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

      // Step 2: Send message to Agentforce (streaming)
      console.log(`${getCurrentTimestamp()} 📤 - FinancialAgentExecutor - Sending message to Agentforce...`);

      const sendMessageBody = {
        message: {
          sequenceId: 1,
          type: "Text",
          text: userText,
        },
      };

      const sendMessageResponse = await fetch(
        `https://api.salesforce.com/einstein/ai-agent/v1/sessions/${sessionId}/messages/stream`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(sendMessageBody),
        },
      );

      if (!sendMessageResponse.ok) {
        const errorText = await sendMessageResponse.text();
        throw new Error(`Failed to send message to Agentforce: ${sendMessageResponse.statusText} - ${errorText}`);
      }

      if (!sendMessageResponse.body) {
        throw new Error("Response body is null");
      }

      // Read the streaming response and publish artifact updates in real-time
      const reader = sendMessageResponse.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const artifactId = uuidv4();

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            console.log(`${getCurrentTimestamp()} 📥 - FinancialAgentExecutor - Stream complete`);
            break;
          }

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE events
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const jsonData = JSON.parse(line.substring(6));
                // Extract text from Agentforce SSE format
                if (jsonData.message?.type === "TextChunk" && jsonData.message?.message) {
                  const chunkText = jsonData.message.message;
                  console.log(`${getCurrentTimestamp()} 📤 Publishing chunk: "${chunkText}"`);

                  // Publish artifact update immediately (streaming pattern from official example)
                  const artifactUpdate: TaskArtifactUpdateEvent = {
                    kind: "artifact-update",
                    taskId,
                    contextId,
                    artifact: {
                      artifactId,
                      name: "response.txt",
                      parts: [{ kind: "text", text: chunkText }],
                    },
                    append: true, // Key: append each chunk to the artifact
                  };
                  eventBus.publish(artifactUpdate);

                  // Yield to event loop to allow transport to flush events
                  await new Promise((resolve) => setImmediate(resolve));
                }
              } catch (parseError) {
                console.warn(`${getCurrentTimestamp()} ⚠️ - Failed to parse SSE data:`, line);
              }
            }
          }
        }
      } catch (streamError) {
        const errorMessage = streamError instanceof Error ? streamError.message : String(streamError);
        throw new Error(`Stream error: ${errorMessage}`);
      }

      console.log(`${getCurrentTimestamp()} 📥 - FinancialAgentExecutor - All chunks published`);

      // Publish final 'completed' state
      eventBus.publish({
        kind: "status-update",
        taskId,
        contextId,
        status: { state: "completed", timestamp: new Date().toISOString() } as TaskStatus,
        final: true,
      });

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

      // Signal that the interaction is finished
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
