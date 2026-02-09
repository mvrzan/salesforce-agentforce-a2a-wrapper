import { v4 as uuidv4 } from "uuid";
import type { Message, Task, TaskStatus, TaskArtifactUpdateEvent } from "@a2a-js/sdk";
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
  private readonly connectionName: string;

  constructor() {
    const connectionName = process.env.APP_LINK_CONNECTION_NAME;
    if (!connectionName) {
      throw new Error("APP_LINK_CONNECTION_NAME environment variable is not set");
    }
    this.connectionName = connectionName;
  }

  async execute(requestContext: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
    let sessionId: string | null = null;
    let isNewSession = false;

    try {
      const userMessage = requestContext.userMessage;
      const userText = userMessage?.parts?.find((part) => part.kind === "text")?.text || "";
      const { taskId, contextId, task } = requestContext;

      console.log(`${getCurrentTimestamp()} 🤖 - FinancialAgentExecutor - Processing A2A request: ${userText}`);

      // Get authentication credentials
      const { accessToken, instanceUrl, agentId } = await this.getAccessToken();

      // Clean up expired sessions
      this.cleanupExpiredSessions();

      // Create initial task if it doesn't exist
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
        status: {
          state: "working",
          timestamp: new Date().toISOString(),
        } as TaskStatus,
        final: false,
      });

      // Get or create Agentforce session
      const sessionInfo = await this.getOrCreateSession(contextId, accessToken, instanceUrl, agentId, taskId, eventBus);
      sessionId = sessionInfo.sessionId;
      isNewSession = sessionInfo.isNewSession;

      // Publish 'working' state
      eventBus.publish({
        kind: "status-update",
        taskId,
        contextId,
        status: {
          state: "working",
          timestamp: new Date().toISOString(),
        } as TaskStatus,
        final: false,
      });

      console.log(`${getCurrentTimestamp()} 📊 - Status: Initializing agent connection...`);

      // Publish detailed status as artifact
      this.publishStatusArtifact(eventBus, taskId, contextId, "Initializing agent connection...");

      // Send message and stream response
      await this.sendMessageToAgentforce(sessionId, userText, accessToken, taskId, contextId, eventBus);

      // Publish final 'completed' state
      eventBus.publish({
        kind: "status-update",
        taskId,
        contextId,
        status: {
          state: "completed",
          timestamp: new Date().toISOString(),
        } as TaskStatus,
        final: true,
      });

      console.log(`${getCurrentTimestamp()} 📊 - Status: Task completed successfully`);

      // Don't delete the session - keep it cached for reuse
      console.log(`${getCurrentTimestamp()} ✅ - FinancialAgentExecutor - Message complete, session kept alive`);

      // Signal that the interaction is finished
      eventBus.finished();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`${getCurrentTimestamp()} ❌ - FinancialAgentExecutor - Error:`, errorMessage);

      // Publish failed status
      eventBus.publish({
        kind: "status-update",
        taskId: requestContext.taskId,
        contextId: requestContext.contextId,
        status: {
          state: "failed",
          timestamp: new Date().toISOString(),
        } as TaskStatus,
        final: true,
      });

      console.log(`${getCurrentTimestamp()} 📊 - Status: Task failed: ${errorMessage}`);

      // On error, remove the session from cache and delete it
      if (sessionId && requestContext.contextId) {
        this.sessionCache.delete(requestContext.contextId);

        try {
          const sdk = salesforceSdk.init();
          const auth = await sdk.addons.applink.getAuthorization(this.connectionName);
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
      console.log(
        `${getCurrentTimestamp()} 🧹 - FinancialAgentExecutor - Cleaning up ${expiredContexts.length} expired sessions`,
      );

      // Remove from cache and attempt to delete from Agentforce
      for (const contextId of expiredContexts) {
        const session = this.sessionCache.get(contextId);
        this.sessionCache.delete(contextId);

        if (session) {
          // Fire and forget - don't await, but log errors
          this.deleteSession(session.sessionId).catch((error) => {
            console.warn(
              `${getCurrentTimestamp()} ⚠️ - FinancialAgentExecutor - Failed to delete expired session ${session.sessionId} for context ${contextId}:`,
              error instanceof Error ? error.message : error,
            );
          });
        }
      }
    }
  }

  private async deleteSession(sessionId: string): Promise<void> {
    try {
      const sdk = salesforceSdk.init();
      const auth = await sdk.addons.applink.getAuthorization(this.connectionName);
      await fetch(`https://api.salesforce.com/einstein/ai-agent/v1/sessions/${sessionId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.accessToken}`,
          "x-session-end-reason": "Expired",
        },
      });
      console.log(`${getCurrentTimestamp()} ✅ - FinancialAgentExecutor - Successfully deleted session ${sessionId}`);
    } catch (error) {
      console.error(
        `${getCurrentTimestamp()} ❌ - FinancialAgentExecutor - Failed to delete expired session ${sessionId}:`,
        error instanceof Error ? error.message : error,
      );
      throw error; // Re-throw so caller's catch handler can log
    }
  }

  private async getAccessToken(): Promise<{ accessToken: string; instanceUrl: string; agentId: string }> {
    try {
      const sdk = salesforceSdk.init();
      const auth = await sdk.addons.applink.getAuthorization(this.connectionName);
      const agentId = process.env.AGENTFORCE_AGENT_ID;

      if (!agentId) {
        throw new Error("AGENTFORCE_AGENT_ID environment variable is not set");
      }

      return {
        accessToken: auth.accessToken,
        instanceUrl: auth.domainUrl,
        agentId,
      };
    } catch (error) {
      console.error(`${getCurrentTimestamp()} ❌ - FinancialAgentExecutor - Failed to get access token:`, error);
      throw new Error(`Authentication failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  private async getOrCreateSession(
    contextId: string,
    accessToken: string,
    instanceUrl: string,
    agentId: string,
    taskId: string,
    eventBus: ExecutionEventBus,
  ): Promise<{ sessionId: string; isNewSession: boolean }> {
    const cachedSession = this.sessionCache.get(contextId);

    if (cachedSession) {
      cachedSession.lastUsed = Date.now();
      console.log(
        `${getCurrentTimestamp()} ♻️ - FinancialAgentExecutor - Reusing cached session: ${cachedSession.sessionId}`,
      );
      this.publishStatusArtifact(eventBus, taskId, contextId, "Using cached session. Preparing query...");
      return { sessionId: cachedSession.sessionId, isNewSession: false };
    }

    // Create new session
    console.log(`${getCurrentTimestamp()} 🚀 - FinancialAgentExecutor - Starting new Agentforce session...`);
    this.publishStatusArtifact(eventBus, taskId, contextId, "Creating new Agentforce session...");

    const externalSessionKey = uuidv4();
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

    try {
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
      const sessionId = sessionData.sessionId;

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
      this.publishStatusArtifact(eventBus, taskId, contextId, "Session ready. Preparing query...");

      return { sessionId, isNewSession: true };
    } catch (error) {
      console.error(
        `${getCurrentTimestamp()} ❌ - FinancialAgentExecutor - Failed to create Agentforce session:`,
        error,
      );
      throw new Error(`Session creation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  private async sendMessageToAgentforce(
    sessionId: string,
    userText: string,
    accessToken: string,
    taskId: string,
    contextId: string,
    eventBus: ExecutionEventBus,
  ): Promise<void> {
    console.log(`${getCurrentTimestamp()} 📤 - FinancialAgentExecutor - Sending message to Agentforce...`);
    this.publishStatusArtifact(eventBus, taskId, contextId, "Querying Agentforce agent...");

    const sendMessageBody = {
      message: {
        sequenceId: 1,
        type: "Text",
        text: userText,
      },
    };

    try {
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

      this.publishStatusArtifact(eventBus, taskId, contextId, "Receiving response from Agentforce...");

      // Process the streaming response
      await this.handleStreamingResponse(sendMessageResponse.body, taskId, contextId, eventBus);

      console.log(`${getCurrentTimestamp()} 📥 - FinancialAgentExecutor - All chunks published successfully`);
    } catch (error) {
      console.error(
        `${getCurrentTimestamp()} ❌ - FinancialAgentExecutor - Failed to send message to Agentforce:`,
        error,
      );
      throw new Error(`Message sending failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  private async handleStreamingResponse(
    body: ReadableStream<Uint8Array>,
    taskId: string,
    contextId: string,
    eventBus: ExecutionEventBus,
  ): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const artifactId = uuidv4();
    let firstChunkReceived = false;

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

                // Log first chunk received
                if (!firstChunkReceived) {
                  firstChunkReceived = true;
                  console.log(
                    `${getCurrentTimestamp()} 📊 - FinancialAgentExecutor - First chunk received, streaming response...`,
                  );
                  this.publishStatusArtifact(eventBus, taskId, contextId, "Streaming response from agent...");
                }

                // Publish artifact update immediately
                const artifactUpdate: TaskArtifactUpdateEvent = {
                  kind: "artifact-update",
                  taskId,
                  contextId,
                  artifact: {
                    artifactId,
                    name: "response.txt",
                    parts: [{ kind: "text", text: chunkText }],
                  },
                  append: true,
                };
                eventBus.publish(artifactUpdate);

                // Yield to event loop to allow transport to flush events
                await new Promise((resolve) => setImmediate(resolve));
              }
            } catch (parseError) {
              console.warn(
                `${getCurrentTimestamp()} ⚠️ - FinancialAgentExecutor - Failed to parse SSE data:`,
                parseError instanceof Error ? parseError.message : parseError,
              );
            }
          }
        }
      }
    } catch (streamError) {
      console.error(`${getCurrentTimestamp()} ❌ - FinancialAgentExecutor - Stream error:`, streamError);
      throw new Error(`Stream error: ${streamError instanceof Error ? streamError.message : "Unknown error"}`);
    } finally {
      // Ensure reader is always released
      try {
        reader.releaseLock();
      } catch (releaseError) {
        console.warn(`${getCurrentTimestamp()} ⚠️ - FinancialAgentExecutor - Failed to release reader lock`);
      }
    }
  }

  private publishStatusArtifact(eventBus: ExecutionEventBus, taskId: string, contextId: string, message: string): void {
    eventBus.publish({
      kind: "artifact-update",
      taskId,
      contextId,
      artifact: {
        artifactId: "__status__",
        name: "status",
        parts: [{ kind: "text", text: message }],
      },
      append: false,
    });
  }

  cancelTask = async (): Promise<void> => {};
}
