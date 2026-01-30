export default function Header() {
  return (
    <header className="bg-linear-to-r from-blue-600 to-purple-600 text-white shadow-lg">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
              <span className="text-2xl">🤖</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold">A2A Agent Bridge</h1>
              <p className="text-blue-100 text-sm">Agentforce to Agent-to-Agent Protocol</p>
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
