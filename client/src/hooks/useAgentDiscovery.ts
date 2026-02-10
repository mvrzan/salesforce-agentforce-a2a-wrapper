import { useState } from "react";
import { AgentClientWrapper } from "../utils/api";
import type { AgentCard } from "../types/agent";

export function useAgentDiscovery() {
  const [agentCard, setAgentCard] = useState<AgentCard | null>(null);
  const [client, setClient] = useState<AgentClientWrapper | null>(null);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [error, setError] = useState<string>("");

  const discoverAgent = async (url: string) => {
    setIsDiscovering(true);
    setError("");

    try {
      const newClient = new AgentClientWrapper(url);
      const card = await newClient.fetchAgentCard();

      setClient(newClient);
      setAgentCard(card);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to discover agent";
      setError(errorMessage);
      console.error("Discovery error:", err);
      throw err;
    } finally {
      setIsDiscovering(false);
    }
  };

  const resetAgent = () => {
    setAgentCard(null);
    setClient(null);
    setError("");
  };

  return {
    agentCard,
    client,
    isDiscovering,
    error,
    discoverAgent,
    resetAgent,
  };
}
