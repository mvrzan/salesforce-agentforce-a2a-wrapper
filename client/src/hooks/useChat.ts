import { useState } from "react";
import { sendMessageToOrchestrator } from "../utils/orchestratorApi";
import type { AgentClientWrapper } from "../utils/api";
import type { Message } from "../types/agent";

interface UseChatProps {
  client: AgentClientWrapper | null;
  useOrchestrator: boolean;
}

export function useChat({ client, useOrchestrator }: UseChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string>("");
  const [contextId] = useState<string>(crypto.randomUUID());

  const clearMessages = () => {
    setMessages([]);
  };

  const sendMessage = async (text: string) => {
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsSending(true);
    setError("");

    // Create placeholder message for streaming chunks
    const placeholderMessageId = crypto.randomUUID();
    const placeholderMessage: Message = {
      id: placeholderMessageId,
      role: "agent",
      text: "",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, placeholderMessage]);

    try {
      if (useOrchestrator) {
        // Use Heroku MIA orchestrator
        const orchestratorMessages = messages
          .filter((m) => m.role === "user" || m.role === "agent")
          .map((m) => ({ role: m.role === "agent" ? ("assistant" as const) : ("user" as const), content: m.text }));

        orchestratorMessages.push({ role: "user", content: text });

        await sendMessageToOrchestrator(
          orchestratorMessages,
          (chunk: string) => {
            // Update the placeholder message with each chunk
            setMessages((prev) =>
              prev.map((msg) => {
                if (msg.id === placeholderMessageId) {
                  // If text ends with "..." it's a status message - replace it
                  // Otherwise append the chunk
                  const isStatusMessage = msg.text.endsWith("...");
                  return { ...msg, text: isStatusMessage ? chunk : msg.text + chunk };
                }
                return msg;
              }),
            );
          },
          (tool: string, result: string) => {
            console.log(`🔧 ${tool} returned: ${result.substring(0, 100)}...`);
          },
          (message: string) => {
            console.log(`📊 Status update: ${message}`);
            // Update placeholder message with status (only if still showing status, not actual content)
            setMessages((prev) =>
              prev.map((msg) => {
                // Only update if message is empty or ends with "..." (status message)
                if (msg.id === placeholderMessageId && (msg.text === "" || msg.text.endsWith("..."))) {
                  return { ...msg, text: message };
                }
                return msg;
              }),
            );
          },
        );
      } else {
        // Direct A2A call to Agentforce
        if (!client) {
          throw new Error("Client not initialized");
        }

        await client.sendMessage(
          text,
          (chunk: string) => {
            // Update the placeholder message with each chunk
            setMessages((prev) =>
              prev.map((msg) => {
                if (msg.id === placeholderMessageId) {
                  // If text ends with "..." it's a status message - replace it
                  // Otherwise append the chunk
                  const isStatusMessage = msg.text.endsWith("...");
                  return { ...msg, text: isStatusMessage ? chunk : msg.text + chunk };
                }
                return msg;
              }),
            );
          },
          contextId,
          (_state: string, message?: string) => {
            // Update placeholder message with status (only if still showing status, not actual content)
            if (message) {
              setMessages((prev) =>
                prev.map((msg) => {
                  // Only update if message is empty or ends with "..." (status message)
                  if (msg.id === placeholderMessageId && (msg.text === "" || msg.text.endsWith("..."))) {
                    return { ...msg, text: message };
                  }
                  return msg;
                }),
              );
            }
          },
        );
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to send message";
      setError(errorMessage);
      console.error("Send message error:", err);

      // Replace placeholder with error message
      setMessages((prev) =>
        prev.map((msg) => (msg.id === placeholderMessageId ? { ...msg, text: `Error: ${errorMessage}` } : msg)),
      );
    } finally {
      setIsSending(false);
    }
  };

  return {
    messages,
    isSending,
    error,
    sendMessage,
    clearMessages,
  };
}
