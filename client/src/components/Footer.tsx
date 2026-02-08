import salesforceLogo from "../assets/salesforce_logo.svg";
import herokuLogo from "../assets/heroku.webp";
import a2aLogo from "../assets/a2a-logo-black.svg";
import githubLogo from "../assets/github-logo.webp";

export default function Footer() {
  return (
    <footer className="bg-gray-800 text-gray-400 mt-auto">
      <div className="container mx-auto px-6 py-4">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-3 md:space-y-0">
          <div className="text-sm">
            <p>&copy; 2026 A2A Agent Bridge</p>
          </div>
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-4">
              <a
                href="https://www.salesforce.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="opacity-70 hover:opacity-100 transition"
              >
                <img src={salesforceLogo} alt="Salesforce" className="h-5 w-auto" />
              </a>
              <a
                href="https://devcenter.heroku.com/articles/heroku-applink"
                target="_blank"
                rel="noopener noreferrer"
                className="opacity-70 hover:opacity-100 transition"
              >
                <img src={herokuLogo} alt="Heroku" className="h-5 w-auto" />
              </a>
              <a
                href="https://a2a-protocol.org/latest/"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white rounded px-2 py-1 opacity-70 hover:opacity-100 transition"
              >
                <img src={a2aLogo} alt="A2A Protocol" className="h-4 w-auto" />
              </a>
            </div>
            <span className="text-gray-600">|</span>
            <a
              href="https://github.com/mvrzan/salesforce-agentforce-a2a-wrapper"
              target="_blank"
              rel="noopener noreferrer"
              className="opacity-70 hover:opacity-100 transition"
            >
              <img src={githubLogo} alt="GitHub" className="h-5 w-auto" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
