export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  tags: string[];
}

export interface AgentCapabilities {
  pushNotifications: boolean;
}

export interface AdditionalInterface {
  url: string;
  transport: string;
}

export interface AgentCard {
  name: string;
  description: string;
  protocolVersion: string;
  version: string;
  url: string;
  skills: AgentSkill[];
  capabilities: AgentCapabilities;
  defaultInputModes: string[];
  defaultOutputModes: string[];
  additionalInterfaces: AdditionalInterface[];
}

export interface Message {
  id: string;
  role: "user" | "agent";
  text: string;
  timestamp: Date;
}

export interface A2AMessageRequest {
  message: {
    sequenceId: number;
    type: "Text";
    text: string;
  };
}

export interface A2AMessageResponse {
  kind: string;
  messageId: string;
  role: string;
  parts: Array<{
    kind: string;
    text: string;
  }>;
  contextId?: string;
}
