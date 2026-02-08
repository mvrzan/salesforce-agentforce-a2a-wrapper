import type { Request, Response } from "express";
import { getCurrentTimestamp } from "../utils/loggingUtil.ts";
import { queryAgentforce } from "../utils/agentforceClient.ts";

const HEROKU_MIA_URL = process.env.INFERENCE_URL;
const HEROKU_MIA_TOKEN = process.env.INFERENCE_KEY;
const HEROKU_MIA_MODEL = process.env.INFERENCE_MODEL_ID;

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

const tools = [
  {
    type: "function",
    function: {
      name: "query_agentforce",
      description:
        "Query the Agentforce financial agent for stock prices, company profiles, and Salesforce earnings data. Use this when the user asks about financial information, stock prices, or company data.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The financial query to send to Agentforce (e.g., 'What is the stock price of CRM?')",
          },
        },
        required: ["query"],
      },
    },
  },
];

export default async function streamOrchestratorChat(req: Request, res: Response) {
  try {
    const { messages } = req.body as { messages: ChatMessage[] };

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Messages array is required" });
    }

    if (!HEROKU_MIA_URL) {
      throw new Error(`${getCurrentTimestamp()} ❌ - streamOrchestratorChat - HEROKU_MIA_URL is not set!`);
    }

    console.log(
      `${getCurrentTimestamp()} 💬 - streamOrchestratorChat - Orchestrator chat request with ${messages.length} messages`,
    );

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Add system message to give the LLM context about its capabilities
    const systemMessage: ChatMessage = {
      role: "system",
      content: `You are an intelligent assistant with access to a financial agent powered by Agentforce. When users ask about stock prices, company information, or financial data, use the query_agentforce function to get accurate, real-time information. 

Be conversational and helpful. If the user's question is about financial markets or specific companies, call the Agentforce agent. For general conversation or non-financial questions, respond directly.`,
    };

    const messagesWithSystem = [systemMessage, ...messages];

    console.log(`${getCurrentTimestamp()} 🚀 - streamOrchestratorChat - Calling Heroku MIA at ${HEROKU_MIA_URL}`);

    // Make request to Heroku MIA
    const response = await fetch(HEROKU_MIA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${HEROKU_MIA_TOKEN}`,
      },
      body: JSON.stringify({
        model: HEROKU_MIA_MODEL,
        messages: messagesWithSystem,
        tools,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `${getCurrentTimestamp()} ❌ - streamOrchestratorChat - Heroku MIA error: ${response.statusText}`,
        errorText,
      );
      throw new Error(`Heroku MIA error: ${response.statusText} - ${errorText}`);
    }

    console.log(`${getCurrentTimestamp()} ✅ - streamOrchestratorChat - Heroku MIA response OK, starting stream`);

    if (!response.body) {
      throw new Error("Response body is null");
    }

    // Stream the response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let currentToolCall: { id: string; name: string; arguments: string } | null = null;

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          console.log(`${getCurrentTimestamp()} ✅ - streamOrchestratorChat - Orchestrator stream complete`);
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmedLine = line.trim();

          // Skip event: lines, we only care about data: lines
          if (trimmedLine.startsWith("event:")) {
            continue;
          }

          if (trimmedLine.startsWith("data:")) {
            // Handle both "data:" and "data: " formats
            const data = trimmedLine.startsWith("data: ") ? trimmedLine.slice(6) : trimmedLine.slice(5);

            if (data === "[DONE]") {
              continue;
            }

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta;

              if (!delta) continue;

              // Handle regular content
              if (delta.content) {
                res.write(`data: ${JSON.stringify({ type: "content", content: delta.content })}\n\n`);
              }

              // Handle tool calls
              if (delta.tool_calls) {
                for (const toolCall of delta.tool_calls) {
                  if (toolCall.function?.name) {
                    currentToolCall = {
                      id: toolCall.id,
                      name: toolCall.function.name,
                      arguments: toolCall.function.arguments || "",
                    };
                  } else if (toolCall.function?.arguments && currentToolCall) {
                    currentToolCall.arguments += toolCall.function.arguments;
                  }
                }
              }

              // If we have a complete tool call, execute it
              if (parsed.choices?.[0]?.finish_reason === "tool_calls" && currentToolCall) {
                console.log(
                  `${getCurrentTimestamp()} 🔧 - streamOrchestratorChat - LLM requesting tool: ${currentToolCall.name}`,
                );

                if (currentToolCall.name === "query_agentforce") {
                  const args = JSON.parse(currentToolCall.arguments);
                  const agentforceResponse = await queryAgentforce(args.query);

                  // Send the Agentforce response back through the stream
                  res.write(
                    `data: ${JSON.stringify({ type: "tool_result", tool: "agentforce", content: agentforceResponse })}\n\n`,
                  );

                  console.log(
                    `${getCurrentTimestamp()} 🔄 - streamOrchestratorChat - Making follow-up request to MIA with tool result`,
                  );

                  // Now make another request to the LLM with the tool result
                  // Format as user message with the tool result (some APIs don't support role: "tool")
                  const followUpMessages = [
                    ...messagesWithSystem,
                    {
                      role: "assistant" as const,
                      content: `Let me check that information for you using the Agentforce financial agent.`,
                    },
                    {
                      role: "user" as const,
                      content: `Here is the information from Agentforce: ${agentforceResponse}`,
                    },
                  ];

                  // Continue the conversation with the tool result
                  const followUpResponse = await fetch(HEROKU_MIA_URL, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${HEROKU_MIA_TOKEN}`,
                    },
                    body: JSON.stringify({
                      model: HEROKU_MIA_MODEL,
                      messages: followUpMessages,
                      stream: true,
                    }),
                  });

                  if (!followUpResponse.ok) {
                    console.error(
                      `${getCurrentTimestamp()} ❌ - streamOrchestratorChat - Follow-up MIA error: ${followUpResponse.statusText}`,
                    );
                    throw new Error(`Follow-up MIA error: ${followUpResponse.statusText}`);
                  }

                  console.log(
                    `${getCurrentTimestamp()} ✅ - streamOrchestratorChat - Follow-up MIA response OK, starting follow-up stream`,
                  );

                  const followUpReader = followUpResponse.body?.getReader();
                  if (followUpReader) {
                    console.log(`${getCurrentTimestamp()} 📖 - streamOrchestratorChat - Reading follow-up stream...`);
                    let followUpBuffer = "";
                    while (true) {
                      const { done: followUpDone, value: followUpValue } = await followUpReader.read();

                      if (followUpDone) {
                        console.log(`${getCurrentTimestamp()} ✅ - streamOrchestratorChat - Follow-up stream complete`);
                        break;
                      }

                      const followUpChunk = decoder.decode(followUpValue, { stream: true });

                      followUpBuffer += followUpChunk;
                      const followUpLines = followUpBuffer.split("\n");
                      followUpBuffer = followUpLines.pop() || "";

                      for (const followUpLine of followUpLines) {
                        const trimmedFollowUpLine = followUpLine.trim();

                        // Skip event: lines
                        if (trimmedFollowUpLine.startsWith("event:")) {
                          continue;
                        }

                        if (trimmedFollowUpLine.startsWith("data:")) {
                          const followUpData = trimmedFollowUpLine.startsWith("data: ")
                            ? trimmedFollowUpLine.slice(6)
                            : trimmedFollowUpLine.slice(5);

                          if (followUpData === "[DONE]") continue;

                          try {
                            const followUpParsed = JSON.parse(followUpData);
                            const followUpDelta = followUpParsed.choices?.[0]?.delta;
                            if (followUpDelta?.content) {
                              res.write(
                                `data: ${JSON.stringify({ type: "content", content: followUpDelta.content })}\n\n`,
                              );
                            }
                          } catch (e) {
                            console.warn(
                              `${getCurrentTimestamp()} ⚠️ - streamOrchestratorChat - Failed to parse follow-up data`,
                            );
                          }
                        }
                      }
                    }
                  }
                }

                currentToolCall = null;
              }
            } catch (parseError) {
              console.warn(
                `${getCurrentTimestamp()} ⚠️ - streamOrchestratorChat - Failed to parse SSE data:`,
                parseError instanceof Error ? parseError.message : parseError,
              );
            }
          }
        }
      }

      res.write("data: [DONE]\n\n");
      res.end();
    } catch (streamError) {
      console.error(`${getCurrentTimestamp()} ❌ - streamOrchestratorChat - Stream error:`, streamError);
      res.write(`data: ${JSON.stringify({ type: "error", content: "Stream error occurred" })}\n\n`);
      res.end();
    }
  } catch (error) {
    console.error(`${getCurrentTimestamp()} ❌ - streamOrchestratorChat - Orchestrator error:`, error);
    if (!res.headersSent) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  }
}
