import { type Request, type Response } from "express";
import { getCurrentTimestamp } from "../utils/loggingUtil.ts";
import salesforceSdk from "@heroku/applink";

const sendStreamingMessage = async (req: Request, res: Response) => {
  try {
    console.log(`${getCurrentTimestamp()} 🎥 - sendStreamingMessage - Request received...`);

    const connectionName = process.env.APP_LINK_CONNECTION_NAME;
    const sdk = salesforceSdk.init();
    const auth = await sdk.addons.applink.getAuthorization(connectionName);
    const accessToken = auth.accessToken;
    const sessionId = req.body.sessionId;
    const message = req.body.message;
    const sequenceId = req.body.sequenceId;

    console.log(`${getCurrentTimestamp()} 🔑 - sendStreamingMessage - Session: ${sessionId}, Sequence: ${sequenceId}`);

    const body = {
      message: {
        sequenceId: sequenceId,
        type: "Text",
        text: message,
      },
    };

    const config = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    };

    console.log(`${getCurrentTimestamp()} 🤖 - sendStreamingMessage - Sending Agentforce message...`);

    const response = await fetch(
      `https://api.salesforce.com/einstein/ai-agent/v1/sessions/${sessionId}/messages/stream`,
      config,
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `${getCurrentTimestamp()} ❌ - sendStreamingMessage - API Error: ${response.status} ${response.statusText}`,
      );
      console.error(`${getCurrentTimestamp()} ❌ - sendStreamingMessage - Response: ${errorText}`);
      throw new Error(`There was an error while sending the Agentforce message: ${response.statusText}`);
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    if (!response.body) {
      throw new Error("Response body is null");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          console.log(`${getCurrentTimestamp()} ✅ - sendStreamingMessage - Stream complete!`);
          // Flush any remaining data and close the connection immediately
          if ("flush" in res && typeof res.flush === "function") res.flush();
          res.end();
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        console.log(`${getCurrentTimestamp()} 📦 - sendStreamingMessage - Chunk received`);

        // Forward the chunk to the frontend and flush immediately
        res.write(chunk);
        if ("flush" in res && typeof res.flush === "function") res.flush();
      }
    } catch (streamError) {
      const errorMessage = streamError instanceof Error ? streamError.message : String(streamError);
      console.error(`${getCurrentTimestamp()} ❌ - sendStreamingMessage - Stream error: ${errorMessage}`);
      res.end();
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(`${getCurrentTimestamp()} ❌ - sendStreamingMessage - Error occurred: ${errorMessage}`);
    res.status(500).json({
      message: errorMessage,
    });
  }
};

export default sendStreamingMessage;
