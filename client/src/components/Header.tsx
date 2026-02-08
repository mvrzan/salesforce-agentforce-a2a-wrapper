import a2aLogo from "../assets/a2a-logo-black.svg";
import agentforceLogo from "../assets/agentforce_logo.webp";

export default function Header() {
  return (
    <header className="bg-linear-to-r from-blue-600 to-purple-600 text-white shadow-lg">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <img src={agentforceLogo} alt="Agentforce" className="h-8 w-auto" />
              <span className="text-white text-2xl font-bold">↔</span>
              <div className="bg-white rounded-lg p-1.5">
                <img src={a2aLogo} alt="A2A Protocol" className="h-6 w-auto" />
              </div>
            </div>
            <div className="border-l border-white/30 pl-4">
              <h1 className="text-xl font-bold">A2A Agent Bridge</h1>
              <p className="text-blue-100 text-xs">Intelligent Agent Orchestration</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 text-sm">
            <span className="bg-white/20 px-3 py-1 rounded-full">Demo</span>
          </div>
        </div>
      </div>
    </header>
  );
}
