import type { AgentCard } from "../types/agent";

interface AgentCardDisplayProps {
  agentCard: AgentCard;
}

export default function AgentCardDisplay({ agentCard }: AgentCardDisplayProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-start space-x-3 mb-6">
        <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-2xl">✅</span>
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900">{agentCard.name}</h2>
          <p className="text-gray-600 mt-1">{agentCard.description}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Agent Info */}
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">Agent Information</h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Protocol Version:</span>
                <span className="text-sm font-medium text-gray-900">{agentCard.protocolVersion}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Agent Version:</span>
                <span className="text-sm font-medium text-gray-900">{agentCard.version}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Push Notifications:</span>
                <span className="text-sm font-medium text-gray-900">
                  {agentCard.capabilities.pushNotifications ? "✅ Enabled" : "❌ Disabled"}
                </span>
              </div>
            </div>
          </div>

          {/* Transport Interfaces */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">Available Transports</h3>
            <div className="space-y-2">
              {agentCard.additionalInterfaces.map((iface, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">{iface.transport}</span>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Available</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Skills */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
            Agent Skills ({agentCard.skills.length})
          </h3>
          <div className="space-y-3">
            {agentCard.skills.map((skill) => (
              <div
                key={skill.id}
                className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-100"
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold text-gray-900">{skill.name}</h4>
                  <span className="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded-full">{skill.id}</span>
                </div>
                <p className="text-sm text-gray-600 mb-3">{skill.description}</p>
                <div className="flex flex-wrap gap-2">
                  {skill.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="text-xs bg-white px-2 py-1 rounded-full text-gray-700 border border-gray-200"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Input/Output Modes */}
      <div className="mt-6 grid md:grid-cols-2 gap-4">
        <div className="bg-green-50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">📥 Input Modes</h3>
          <div className="flex flex-wrap gap-2">
            {agentCard.defaultInputModes.map((mode, index) => (
              <span key={index} className="text-sm bg-green-100 text-green-800 px-3 py-1 rounded-full">
                {mode}
              </span>
            ))}
          </div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">📤 Output Modes</h3>
          <div className="flex flex-wrap gap-2">
            {agentCard.defaultOutputModes.map((mode, index) => (
              <span key={index} className="text-sm bg-purple-100 text-purple-800 px-3 py-1 rounded-full">
                {mode}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
