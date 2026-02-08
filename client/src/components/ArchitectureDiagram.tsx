interface ArchitectureDiagramProps {
  useOrchestrator: boolean;
}

export default function ArchitectureDiagram({ useOrchestrator }: ArchitectureDiagramProps) {
  return (
    <div className="mt-12 bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        Architecture Overview: {useOrchestrator ? "Orchestrator Mode" : "Direct A2A Mode"}
      </h2>
      <div className="bg-linear-to-r from-blue-50 to-purple-50 rounded-lg p-6">
        {useOrchestrator ? (
          // Orchestrator Mode Architecture
          <div className="flex flex-col items-center space-y-4">
            <div className="flex flex-col md:flex-row items-center justify-center space-y-4 md:space-y-0 md:space-x-4 text-center">
              <div className="bg-white rounded-lg p-4 shadow">
                <div className="text-2xl mb-2">👤</div>
                <div className="font-semibold text-gray-900">User</div>
                <div className="text-xs text-gray-600">(This Website)</div>
              </div>

              <div className="text-2xl">→</div>

              <div className="bg-white rounded-lg p-4 shadow border-2 border-purple-500">
                <div className="text-2xl mb-2">🧠</div>
                <div className="font-semibold text-gray-900">Heroku MIA</div>
                <div className="text-xs text-gray-600">(Claude 4.5 Sonnet)</div>
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
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm text-purple-900 max-w-2xl">
              <strong>💡 How it works:</strong> Heroku MIA (Claude 4.5 Sonnet) intelligently decides when to call
              Agentforce. For general questions, it responds directly. For financial queries, it delegates to Agentforce
              via A2A protocol using function calling.
            </div>
          </div>
        ) : (
          // Direct A2A Mode Architecture
          <div className="flex flex-col items-center space-y-4">
            <div className="flex flex-col md:flex-row items-center justify-center space-y-4 md:space-y-0 md:space-x-4 text-center">
              <div className="bg-white rounded-lg p-4 shadow">
                <div className="text-2xl mb-2">👤</div>
                <div className="font-semibold text-gray-900">A2A Client</div>
                <div className="text-xs text-gray-600">(This Website)</div>
              </div>

              <div className="text-2xl">→</div>

              <div className="bg-white rounded-lg p-4 shadow border-2 border-blue-500">
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
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900 max-w-2xl">
              <strong>💡 How it works:</strong> Direct connection using A2A Protocol. Your browser communicates with the
              A2A server, which wraps Agentforce capabilities and exposes them via standard A2A endpoints.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
