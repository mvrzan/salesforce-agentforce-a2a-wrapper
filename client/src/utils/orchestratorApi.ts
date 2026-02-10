import { generateSignature } from "./requestSigner";

interface OrchestratorMessage {
  role: "user" | "assistant";
  content: string;
}

interface OrchestratorStreamEvent {
  type: "content" | "tool_result" | "error" | "status";
  content?: string;
  message?: string;
  tool?: string;
}

export async function sendMessageToOrchestrator(
  messages: OrchestratorMessage[],
  onChunk: (chunk: string) => void,
  onToolCall?: (tool: string, result: string) => void,
  onStatus?: (message: string) => void,
): Promise<void> {
  // Use production URL if deployed, localhost for local development
  const baseUrl = window.location.hostname === "localhost" ? "http://localhost:3000" : import.meta.env.VITE_API_URL;

  // Generate signature for request authentication
  const { timestamp, signature } = await generateSignature("POST", "/api/orchestrator/chat");

  console.log("📤 Sending to orchestrator:", messages);
  const response = await fetch(`${baseUrl}/api/orchestrator/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Timestamp": timestamp,
      "X-Signature": signature,
    },
    body: JSON.stringify({ messages }),
  });

  if (!response.ok) {
    throw new Error(`Orchestrator error: ${response.statusText}`);
  }

  if (!response.body) {
    throw new Error("Response body is null");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        console.log("🎉 Orchestrator stream complete");
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);

          if (data === "[DONE]") {
            continue;
          }

          try {
            const event = JSON.parse(data) as OrchestratorStreamEvent;

            if (event.type === "content" && event.content) {
              onChunk(event.content);
            } else if (event.type === "status" && onStatus && event.message) {
              onStatus(event.message);
            } else if (event.type === "tool_result" && onToolCall && event.content) {
              console.log(`🔧 Tool called: ${event.tool}, result length: ${event.content.length}`);
              onToolCall(event.tool || "unknown", event.content);
            } else if (event.type === "error" && event.content) {
              throw new Error(event.content);
            }
          } catch (parseError) {
            console.warn("Failed to parse orchestrator event:", line);
            console.error(parseError);
          }
        }
      }
    }
  } catch (error) {
    console.error("❌ Orchestrator stream error:", error);
    throw error;
  }
}
