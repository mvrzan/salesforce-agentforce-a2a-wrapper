import { ClientFactory } from "@a2a-js/sdk/client";
import { getCurrentTimestamp } from "./loggingUtil.ts";

/**
 * Call Agentforce via A2A protocol
 * Used by the orchestrator to delegate financial queries to the Agentforce agent
 */
export async function queryAgentforce(query: string): Promise<string> {
  try {
    const baseUrl = process.env.APP_URL || "http://localhost:3000";
    const factory = new ClientFactory();
    const client = await factory.createFromUrl(baseUrl);

    console.log(`${getCurrentTimestamp()} 🔄 - Orchestrator calling Agentforce: "${query}"`);

    let fullResponse = "";
    const stream = client.sendMessageStream({
      message: {
        messageId: crypto.randomUUID(),
        role: "user",
        parts: [{ kind: "text", text: query }],
        kind: "message",
      },
    });

    for await (const event of stream) {
      if (event.kind === "message") {
        const textPart = event.parts?.find((part) => part.kind === "text");
        if (textPart && "text" in textPart) {
          fullResponse = textPart.text;
        }
      } else if (event.kind === "artifact-update") {
        const textPart = event.artifact?.parts?.find((p) => p.kind === "text");
        if (textPart && "text" in textPart) {
          if (event.append) {
            fullResponse += textPart.text;
          } else {
            fullResponse = textPart.text;
          }
        }
      } else if (event.kind === "task" && event.artifacts) {
        for (const artifact of event.artifacts) {
          for (const part of artifact.parts) {
            if (part.kind === "text" && "text" in part) {
              fullResponse += part.text;
            }
          }
        }
      }
    }

    console.log(`${getCurrentTimestamp()} ✅ - Agentforce response received: ${fullResponse.substring(0, 100)}...`);
    return fullResponse;
  } catch (error) {
    console.error(`${getCurrentTimestamp()} ❌ - Error calling Agentforce:`, error);
    throw error;
  }
}
