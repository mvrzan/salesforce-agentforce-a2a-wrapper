import { useState } from "react";
import Header from "./components/Header";
import Footer from "./components/Footer";
import AgentDiscovery from "./components/AgentDiscovery";
import AgentCardDisplay from "./components/AgentCardDisplay";
import ChatInterface from "./components/ChatInterface";
import { AgentClientWrapper } from "./utils/api";
import { sendMessageToOrchestrator } from "./utils/orchestratorApi";
import type { AgentCard, Message } from "./types/agent";

function App() {
  const [agentCard, setAgentCard] = useState<AgentCard | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string>("");
  const [client, setClient] = useState<AgentClientWrapper | null>(null);
  const [contextId] = useState<string>(crypto.randomUUID());
  const [useOrchestrator, setUseOrchestrator] = useState(true);

  const handleAgentDiscovered = async (url: string) => {
    setIsDiscovering(true);
    setError("");

    try {
      const newClient = new AgentClientWrapper(url);
      const card = await newClient.fetchAgentCard();

      setClient(newClient);
      setAgentCard(card);
      setMessages([]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to discover agent";
      setError(errorMessage);
      console.error("Discovery error:", err);
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!agentCard) return;

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
            console.log(`📝 Received chunk in App.tsx: "${chunk}"`);
            // Update the placeholder message with each chunk
            setMessages((prev) =>
              prev.map((msg) => (msg.id === placeholderMessageId ? { ...msg, text: msg.text + chunk } : msg)),
            );
          },
          (tool: string, result: string) => {
            console.log(`🔧 ${tool} returned: ${result.substring(0, 100)}...`);
          },
        );
      } else {
        // Direct A2A call to Agentforce
        if (!client) return;

        await client.sendMessage(
          text,
          (chunk: string) => {
            // Update the placeholder message with each chunk
            setMessages((prev) =>
              prev.map((msg) => (msg.id === placeholderMessageId ? { ...msg, text: msg.text + chunk } : msg)),
            );
          },
          contextId,
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />

      <main className="flex-1 container mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <span className="text-red-600">⚠️</span>
              <p className="text-red-800">{error}</p>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* Agent Discovery Section */}
          {!agentCard && <AgentDiscovery onAgentDiscovered={handleAgentDiscovered} isLoading={isDiscovering} />}

          {/* Agent Card Display Section */}
          {agentCard && (
            <>
              {/* Mode Toggle */}
              <div className="bg-white rounded-lg shadow-md p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">Chat Mode</h3>
                    <p className="text-sm text-gray-600">
                      {useOrchestrator ? "Heroku MIA Orchestrator (Agent-to-Agent)" : "Direct A2A Connection"}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setUseOrchestrator(!useOrchestrator);
                      setMessages([]);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition font-medium"
                  >
                    Switch to {useOrchestrator ? "Direct Mode" : "Orchestrator Mode"}
                  </button>
                </div>
                {useOrchestrator && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <span className="text-blue-600">🤖</span>
                      <p className="text-sm text-blue-800">
                        <strong>Orchestrator Mode:</strong> Your questions are first analyzed by Heroku MIA LLM, which
                        intelligently decides when to delegate to the Agentforce agent via A2A protocol.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <AgentCardDisplay agentCard={agentCard} />

              {/* Chat Interface Section */}
              <ChatInterface
                agentCard={agentCard}
                onSendMessage={handleSendMessage}
                messages={messages}
                isLoading={isSending}
                useOrchestrator={useOrchestrator}
              />

              {/* Reset Button */}
              <div className="text-center">
                <button
                  onClick={() => {
                    setAgentCard(null);
                    setMessages([]);
                    setClient(null);
                    setError("");
                  }}
                  className="text-gray-600 hover:text-gray-900 text-sm font-medium transition"
                >
                  🔄 Discover Different Agent
                </button>
              </div>
            </>
          )}
        </div>

        {/* Architecture Diagram */}
        <div className="mt-12 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Architecture Overview</h2>
          <div className="bg-linear-to-r from-blue-50 to-purple-50 rounded-lg p-6">
            <div className="flex flex-col md:flex-row items-center justify-center space-y-4 md:space-y-0 md:space-x-4 text-center">
              <div className="bg-white rounded-lg p-4 shadow">
                <div className="text-2xl mb-2">👤</div>
                <div className="font-semibold text-gray-900">A2A Client</div>
                <div className="text-xs text-gray-600">(This Website)</div>
              </div>

              <div className="text-2xl">→</div>

              <div className="bg-white rounded-lg p-4 shadow">
                <div className="text-2xl mb-2">🌐</div>
                <div className="font-semibold text-gray-900">A2A Server</div>
                <div className="text-xs text-gray-600">(Your Bridge)</div>
              </div>

              <div className="text-2xl">→</div>

              <div className="bg-white rounded-lg p-4 shadow">
                <div className="text-2xl mb-2">⚡</div>
                <div className="font-semibold text-gray-900">Agentforce</div>
                <div className="text-xs text-gray-600">(Salesforce APIs)</div>
              </div>

              <div className="text-2xl">→</div>

              <div className="bg-white rounded-lg p-4 shadow">
                <div className="text-2xl mb-2">📊</div>
                <div className="font-semibold text-gray-900">Data Sources</div>
                <div className="text-xs text-gray-600">(Finnhub, etc.)</div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default App;
