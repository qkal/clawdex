import type { Submission, Op, Event } from "@clawdex/shared-types";

let submissionCounter = 0;

/** Create a typed Submission message. */
export function createSubmission(op: Op): Submission {
  return {
    id: `sub-${++submissionCounter}-${Date.now()}`,
    op,
  };
}

/** Parse a raw WS message into an Event. Returns null if invalid. */
export function parseEvent(raw: string): Event | null {
  try {
    const data = JSON.parse(raw);
    if (!data.msg || !data.msg.type) return null;
    return data as Event;
  } catch {
    return null;
  }
}
