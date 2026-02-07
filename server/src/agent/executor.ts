import { v4 as uuidv4 } from "uuid";
import type { Message, Task, TaskStatus, Artifact, TaskArtifactUpdateEvent } from "@a2a-js/sdk";
import type { AgentExecutor, RequestContext, ExecutionEventBus } from "@a2a-js/sdk/server";
import { getCurrentTimestamp } from "../utils/loggingUtil.ts";
import salesforceSdk from "@heroku/applink";

interface SessionCache {
  sessionId: string;
  externalSessionKey: string;
  lastUsed: number;
}

export class FinancialAgentExecutor implements AgentExecutor {
  private sessionCache: Map<string, SessionCache> = new Map();
  private readonly SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

  async execute(requestContext: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
    let sessionId: string | null = null;
    let isNewSession = false;

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

      // Clean up expired sessions
      this.cleanupExpiredSessions();

      // Check if we have a cached session for this context
      let externalSessionKey: string;
      const cachedSession = this.sessionCache.get(contextId);

      if (cachedSession) {
        sessionId = cachedSession.sessionId;
        externalSessionKey = cachedSession.externalSessionKey;
        cachedSession.lastUsed = Date.now();
        console.log(`${getCurrentTimestamp()} ♻️ - FinancialAgentExecutor - Reusing session: ${sessionId}`);
      } else {
        // Generate a unique external session key for new session
        externalSessionKey = uuidv4();
        isNewSession = true;
      }

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

      // Step 1: Start Agentforce session (only if we don't have a cached session)
      if (isNewSession) {
        console.log(`${getCurrentTimestamp()} 🚀 - FinancialAgentExecutor - Starting new Agentforce session...`);

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

        if (!sessionId) {
          throw new Error("Failed to get session ID from Agentforce response");
        }

        // Cache the session
        this.sessionCache.set(contextId, {
          sessionId,
          externalSessionKey,
          lastUsed: Date.now(),
        });

        console.log(`${getCurrentTimestamp()} ✅ - FinancialAgentExecutor - Session started and cached: ${sessionId}`);
      }

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

      // Don't delete the session - keep it cached for reuse
      console.log(`${getCurrentTimestamp()} ✅ - FinancialAgentExecutor - Message complete, session kept alive`);

      // Signal that the interaction is finished
      eventBus.finished();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`${getCurrentTimestamp()} ❌ - FinancialAgentExecutor - Error:`, errorMessage);

      // On error, remove the session from cache and delete it
      if (sessionId && requestContext.contextId) {
        this.sessionCache.delete(requestContext.contextId);

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

  private cleanupExpiredSessions(): void {
    const now = Date.now();
    const expiredContexts: string[] = [];

    for (const [contextId, session] of this.sessionCache.entries()) {
      if (now - session.lastUsed > this.SESSION_TTL_MS) {
        expiredContexts.push(contextId);
      }
    }

    if (expiredContexts.length > 0) {
      console.log(`${getCurrentTimestamp()} 🧹 - Cleaning up ${expiredContexts.length} expired sessions`);

      // Remove from cache and attempt to delete from Agentforce
      for (const contextId of expiredContexts) {
        const session = this.sessionCache.get(contextId);
        this.sessionCache.delete(contextId);

        if (session) {
          // Fire and forget - don't await
          this.deleteSession(session.sessionId).catch(() => {
            // Ignore cleanup errors
          });
        }
      }
    }
  }

  private async deleteSession(sessionId: string): Promise<void> {
    try {
      const sdk = salesforceSdk.init();
      const auth = await sdk.addons.applink.getAuthorization("AFMatija");
      await fetch(`https://api.salesforce.com/einstein/ai-agent/v1/sessions/${sessionId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.accessToken}`,
          "x-session-end-reason": "Expired",
        },
      });
    } catch (error) {
      console.warn(`${getCurrentTimestamp()} ⚠️ - Failed to delete expired session ${sessionId}`);
    }
  }

  cancelTask = async (): Promise<void> => {};
}
