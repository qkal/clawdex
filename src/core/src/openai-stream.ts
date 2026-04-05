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

/** HTTP status codes that warrant a retry with backoff. */
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

/** Max retry attempts before surfacing a terminal error. */
const MAX_RETRIES = 3;

/**
 * Create an async generator that streams OpenAI Responses API events.
 *
 * Retries automatically on transient HTTP errors (429, 5xx) with exponential
 * backoff (1 s → 2 s → 4 s, up to MAX_RETRIES attempts). Before each
 * retry a `stream_retrying` event is yielded so callers can surface feedback.
 *
 * Accepts optional fetchFn and sleepFn overrides for testing.
 */
export async function* createOpenAIStream(
  config: OpenAIStreamConfig,
  fetchFn: (url: string, init: RequestInit) => Promise<Response> = fetch,
  sleepFn: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
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
      if (!("role" in m)) {
        // function_call variant — no role property
        return { type: "function_call", id: m.call_id, name: m.name, arguments: m.arguments };
      }
      if (m.role === "tool") {
        return { type: "function_call_output", call_id: m.tool_call_id, output: m.content };
      }
      return { role: m.role, content: m.content };
    }),
    tools: toolDefs.length > 0 ? toolDefs : undefined,
    stream: true,
    ...(config.reasoningEffort ? { reasoning: { effort: config.reasoningEffort } } : {}),
  });

  const requestInit: RequestInit = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body,
  };

  // Retry loop — only the initial HTTP handshake is retried.
  // Once streaming begins, errors are not retryable.
  let response: Response | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const r = await fetchFn(url, requestInit);

    if (r.ok) {
      response = r;
      break;
    }

    let message = `OpenAI API error: ${r.status}`;
    try {
      const errBody = await r.json() as { error?: { message?: string } };
      if (errBody.error?.message) message = errBody.error.message;
    } catch {
      await r.body?.cancel().catch(() => {});
    }

    if (!RETRYABLE_STATUSES.has(r.status) || attempt === MAX_RETRIES) {
      yield { type: "response.error", message };
      return;
    }

    // Retryable — yield a transient event so the caller can surface UI feedback,
    // then sleep with exponential backoff before the next attempt.
    yield { type: "stream_retrying", attempt: attempt + 1, status: r.status, message };
    const backoffMs = 1000 * Math.pow(2, attempt);
    await sleepFn(backoffMs);
  }

  if (!response?.body) {
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
