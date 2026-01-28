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

  async sendMessage(message: string, onChunk?: (chunk: string) => void, contextId?: string): Promise<string> {
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
        // Streaming artifact chunks - call callback for real-time display
        if (event.artifact?.parts) {
          for (const part of event.artifact.parts) {
            if (part.kind === "text" && "text" in part) {
              const chunkText = part.text;
              console.log("📤 Chunk received:", chunkText);

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
