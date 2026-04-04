/**
 * @clawdex/sandbox — sandbox backends for filesystem and network access control.
 *
 * Exports:
 * - createSandbox()  — factory that selects the right backend for the platform
 * - NoopSandbox      — allows everything (development / danger-full-access)
 * - WindowsSandbox   — Windows path-based access control (future: Job Objects)
 * - LinuxSandbox     — Linux path-based access control (future: Landlock LSM)
 */

export { createSandbox } from "./factory.js";
export type { SandboxFactoryOptions } from "./factory.js";

export { NoopSandbox } from "./noop.js";
export { WindowsSandbox } from "./windows.js";
export type { WindowsSandboxOptions } from "./windows.js";
export { LinuxSandbox } from "./linux.js";
export type { LinuxSandboxOptions } from "./linux.js";

// Re-export types from shared-types for convenience
export type { ISandbox, SandboxCheckResult } from "@clawdex/shared-types";
