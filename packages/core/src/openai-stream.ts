import type { OpenAIStreamEvent, OpenAIMessage } from "./types.js";

export interface OpenAIToolDef {
  name: string;
  description: string;
  parameters: object;
}

export interface OpenAIStreamConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: OpenAIMessage[];
  tools: OpenAIToolDef[];
  reasoningEffort?: "low" | "medium" | "high";
}

/** Parse a single SSE line into a typed event (or null if not a data line). */
export function parseSSELine(line: string): OpenAIStreamEvent | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith(":") || !trimmed.startsWith("data: ")) {
    return null;
  }

  const payload = trimmed.slice(6); // Remove "data: "
  if (payload === "[DONE]") {
    return { type: "response.done" };
  }

  try {
    return JSON.parse(payload) as OpenAIStreamEvent;
  } catch {
    return null;
  }
}

/**
 * Create an async generator that streams OpenAI Responses API events.
 * Accepts an optional fetchFn override for testing.
 */
export async function* createOpenAIStream(
  config: OpenAIStreamConfig,
  fetchFn: (url: string, init: RequestInit) => Promise<Response> = fetch,
): AsyncGenerator<OpenAIStreamEvent> {
  const url = `${config.baseUrl}/responses`;

  const toolDefs = config.tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));

  const body = JSON.stringify({
    model: config.model,
    input: config.messages.map((m) => {
      if (m.role === "tool") {
        return { type: "function_call_output", call_id: m.tool_call_id, output: m.content };
      }
      return { role: m.role, content: m.content };
    }),
    tools: toolDefs.length > 0 ? toolDefs : undefined,
    stream: true,
    ...(config.reasoningEffort ? { reasoning: { effort: config.reasoningEffort } } : {}),
  });

  const response = await fetchFn(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body,
  });

  if (!response.ok) {
    let message = `OpenAI API error: ${response.status}`;
    try {
      const errBody = await response.json() as { error?: { message?: string } };
      if (errBody.error?.message) {
        message = errBody.error.message;
      }
    } catch {
      // Use status code message
    }
    yield { type: "response.error", message };
    return;
  }

  if (!response.body) {
    yield { type: "response.error", message: "No response body" };
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by double newlines
      const parts = buffer.split("\n\n");
      // Keep the last (possibly incomplete) part in the buffer
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        for (const line of part.split("\n")) {
          const event = parseSSELine(line);
          if (event) {
            yield event;
          }
        }
      }
    }

    // Process any remaining buffer
    if (buffer.trim()) {
      for (const line of buffer.split("\n")) {
        const event = parseSSELine(line);
        if (event) {
          yield event;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
