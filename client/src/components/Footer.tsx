export default function Footer() {
  return (
    <footer className="bg-gray-800 text-gray-400 mt-auto">
      <div className="container mx-auto px-6 py-4">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-2 md:space-y-0">
          <div className="text-sm">
            <p>&copy; 2026 A2A Agent Bridge. Demonstrating Agentforce ↔ A2A Protocol Integration</p>
          </div>
          <div className="flex items-center space-x-4 text-sm">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition"
            >
              GitHub
            </a>
            <span>•</span>
            <a
              href="https://salesforce.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition"
            >
              Agentforce
            </a>
            <span>•</span>
            <a
              href="https://a2a-protocol.org"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition"
            >
              A2A Protocol
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
