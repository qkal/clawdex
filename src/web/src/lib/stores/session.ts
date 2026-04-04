import { writable } from "svelte/store";
import type { SessionSummary, SessionSnapshot } from "@clawdex/shared-types";

export const activeSessionId = writable<string | null>(null);
export const sessionList = writable<SessionSummary[]>([]);
export const activeSnapshot = writable<SessionSnapshot | null>(null);
