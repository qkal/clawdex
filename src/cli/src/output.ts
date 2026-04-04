import type { EventMsg } from "@clawdex/shared-types";

export function formatExecOutput(
  events: EventMsg[],
  format: "text" | "json" | "quiet",
): string {
  switch (format) {
    case "text": {
      const messages = events
        .filter((e) => e.type === "agent_message")
        .map((e) => (e as any).message);
      return messages.join("\n");
    }

    case "quiet": {
      // Return only the final agent message
      const lastMsg = [...events]
        .reverse()
        .find((e) => e.type === "agent_message");
      return lastMsg ? (lastMsg as any).message : "";
    }

    case "json": {
      return events.map((e) => JSON.stringify(e)).join("\n");
    }
  }
}

/** Stream an event to stdout in the given format. */
export function streamEventToStdout(event: EventMsg, format: "text" | "json" | "quiet"): void {
  switch (format) {
    case "text":
      if (event.type === "agent_message_delta") {
        process.stdout.write((event as any).delta);
      } else if (event.type === "agent_message") {
        process.stdout.write("\n");
      } else if (event.type === "error") {
        process.stderr.write(`Error: ${(event as any).message}\n`);
      }
      break;

    case "json":
      process.stdout.write(JSON.stringify(event) + "\n");
      break;

    case "quiet":
      // Only output at end
      break;
  }
}
