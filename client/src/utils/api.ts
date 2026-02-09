import { ClientFactory } from "@a2a-js/sdk/client";
import type { AgentCard } from "../types/agent";

export class AgentClientWrapper {
  private client: Awaited<ReturnType<ClientFactory["createFromUrl"]>> | null = null;
  private baseUrl: string;
  private factory: ClientFactory;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ""); // Remove trailing slash
    this.factory = new ClientFactory();
  }

  async fetchAgentCard(): Promise<AgentCard> {
    // Create client from URL - this will fetch the agent card
    this.client = await this.factory.createFromUrl(this.baseUrl);

    // Use getAgentCard() to retrieve the agent card
    const card = await this.client.getAgentCard();
    return card as AgentCard;
  }

  async sendMessage(
    message: string,
    onChunk?: (chunk: string) => void,
    contextId?: string,
    onStatus?: (state: string, message?: string) => void,
  ): Promise<string> {
    if (!this.client) {
      throw new Error("Client not initialized. Call fetchAgentCard first.");
    }

    const userMessage = {
      kind: "message" as const,
      messageId: crypto.randomUUID(),
      role: "user" as const,
      parts: [{ kind: "text" as const, text: message }],
      contextId: contextId || crypto.randomUUID(),
    };

    // Use sendMessageStream to receive the response
    const stream = this.client.sendMessageStream({ message: userMessage });
    let fullResponse = "";
    let firstChunkReceived = false;

    for await (const event of stream) {
      console.log("📥 Received event:", event.kind);

      // Handle different event types according to A2A spec
      if (event.kind === "message") {
        // Complete message response (Message-only stream pattern)
        if (event.parts && event.parts.length > 0) {
          const textPart = event.parts.find((part) => part.kind === "text");
          if (textPart && "text" in textPart) {
            fullResponse = textPart.text;
            console.log("💬 Complete message received");
          }
        }
      } else if (event.kind === "task") {
        // Task with artifacts
        console.log("📋 Task:", event.status?.state);
        if (event.artifacts && event.artifacts.length > 0) {
          for (const artifact of event.artifacts) {
            if (artifact.parts) {
              for (const part of artifact.parts) {
                if (part.kind === "text" && "text" in part) {
                  fullResponse += part.text;
                }
              }
            }
          }
        }
      } else if (event.kind === "artifact-update") {
        // Check if this is a status artifact (special artifact ID)
        if (event.artifact?.artifactId === "__status__" && event.artifact?.parts) {
          // This is a status update, not content
          for (const part of event.artifact.parts) {
            if (part.kind === "text" && "text" in part && onStatus) {
              console.log("📊 Detailed status:", part.text);
              onStatus("working", part.text);
            }
          }
        } else if (event.artifact?.parts) {
          // Regular content artifact - streaming chunks
          for (const part of event.artifact.parts) {
            if (part.kind === "text" && "text" in part) {
              const chunkText = part.text;
              console.log("📤 Chunk received:", chunkText);

              // Mark that we've started receiving content
              if (!firstChunkReceived) {
                firstChunkReceived = true;
              }

              // Accumulate full response
              if (event.append) {
                fullResponse += chunkText;
              } else {
                fullResponse = chunkText;
              }

              // Call chunk callback for real-time display
              if (onChunk) {
                onChunk(chunkText);
              }
            }
          }
        }
      } else if (event.kind === "status-update") {
        console.log("📊 Task status:", event.status?.state);

        // Call status callback with state
        if (onStatus && event.status) {
          // Generate friendly message based on state (fallback if no detailed status sent)
          let friendlyMessage: string | undefined;
          if (event.status.state === "submitted") {
            friendlyMessage = "Request submitted...";
          } else if (event.status.state === "working") {
            friendlyMessage = "Processing request...";
          } else if (event.status.state === "completed") {
            friendlyMessage = "Response completed successfully";
          } else if (event.status.state === "failed") {
            friendlyMessage = "Request failed";
          }
          onStatus(event.status.state, friendlyMessage);
        }
      }
    }

    return fullResponse || "No response from agent";
  }
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
