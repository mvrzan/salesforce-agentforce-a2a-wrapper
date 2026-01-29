import { useState } from "react";
import { isValidUrl } from "../utils/api";

interface AgentDiscoveryProps {
  onAgentDiscovered: (url: string) => void;
  isLoading: boolean;
}

export default function AgentDiscovery({ onAgentDiscovered, isLoading }: AgentDiscoveryProps) {
  const [url, setUrl] = useState("http://localhost:3000");
  const [error, setError] = useState<string>("");

  const handleDiscover = () => {
    setError("");

    if (!url.trim()) {
      setError("Please enter a URL");
      return;
    }

    if (!isValidUrl(url)) {
      setError("Please enter a valid URL");
      return;
    }

    onAgentDiscovered(url);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isLoading) {
      handleDiscover();
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-start space-x-3 mb-4">
        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
          <span className="text-xl">🔍</span>
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-gray-900">Agent Discovery</h2>
          <p className="text-gray-600 text-sm mt-1">
            Enter the URL of your A2A server to discover available agent capabilities
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="agent-url" className="block text-sm font-medium text-gray-700 mb-2">
            A2A Server URL
          </label>
          <input
            id="agent-url"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="http://localhost:3000"
            disabled={isLoading}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          {error && (
            <p className="mt-2 text-sm text-red-600 flex items-center space-x-1">
              <span>⚠️</span>
              <span>{error}</span>
            </p>
          )}
        </div>

        <button
          onClick={handleDiscover}
          disabled={isLoading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
          {isLoading ? (
            <>
              <svg
                className="animate-spin h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <span>Discovering...</span>
            </>
          ) : (
            <>
              <span>🔍</span>
              <span>Discover Agent</span>
            </>
          )}
        </button>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            <strong>💡 Tip:</strong> The server will fetch{" "}
            <code className="bg-blue-100 px-2 py-0.5 rounded">/.well-known/agent-card.json</code> to discover agent
            capabilities
          </p>
        </div>
      </div>
    </div>
  );
}
