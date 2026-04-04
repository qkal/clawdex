import { describe, expect, test } from "bun:test";
import { createSandbox } from "../src/factory";
import { NoopSandbox } from "../src/noop";

describe("createSandbox", () => {
  test("returns NoopSandbox for danger-full-access", () => {
    const sandbox = createSandbox("danger-full-access", { writableRoots: [], networkAccess: true });
    expect(sandbox).toBeInstanceOf(NoopSandbox);
  });

  test("returns NoopSandbox for any mode (MVP — platform backends not implemented)", () => {
    const sandbox = createSandbox("workspace-write", { writableRoots: ["/project"], networkAccess: false });
    expect(sandbox).toBeInstanceOf(NoopSandbox);
  });
});
