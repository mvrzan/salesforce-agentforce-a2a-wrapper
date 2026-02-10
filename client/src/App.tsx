import Header from "./components/Header";
import Footer from "./components/Footer";
import AgentDiscovery from "./components/AgentDiscovery";
import AgentCardDisplay from "./components/AgentCardDisplay";
import ChatInterface from "./components/ChatInterface";
import ArchitectureDiagram from "./components/ArchitectureDiagram";
import { useAgentDiscovery } from "./hooks/useAgentDiscovery";
import { useChat } from "./hooks/useChat";
import { useChatMode } from "./hooks/useChatMode";

function App() {
  const { agentCard, client, isDiscovering, error: discoveryError, discoverAgent, resetAgent } = useAgentDiscovery();
  const { useOrchestrator, toggleMode } = useChatMode(true);
  const { messages, isSending, error: chatError, sendMessage, clearMessages } = useChat({ client, useOrchestrator });

  const error = discoveryError || chatError;

  const handleAgentDiscovered = async (url: string) => {
    await discoverAgent(url);
    clearMessages();
  };

  const handleModeSwitch = () => {
    toggleMode();
    clearMessages();
  };

  const handleReset = () => {
    resetAgent();
    clearMessages();
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
                    onClick={handleModeSwitch}
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
                onSendMessage={sendMessage}
                messages={messages}
                isLoading={isSending}
                useOrchestrator={useOrchestrator}
              />

              {/* Reset Button */}
              <div className="text-center">
                <button
                  onClick={handleReset}
                  className="text-gray-600 hover:text-gray-900 text-sm font-medium transition"
                >
                  🔄 Discover Different Agent
                </button>
              </div>
            </>
          )}
        </div>

        {/* Architecture Diagram */}
        <ArchitectureDiagram useOrchestrator={useOrchestrator} />
      </main>

      <Footer />
    </div>
  );
}

export default App;
