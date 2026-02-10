import { useState } from "react";

export function useChatMode(initialMode: boolean = true) {
  const [useOrchestrator, setUseOrchestrator] = useState(initialMode);

  const toggleMode = () => {
    setUseOrchestrator((prev) => !prev);
  };

  return {
    useOrchestrator,
    toggleMode,
    setUseOrchestrator,
  };
}
