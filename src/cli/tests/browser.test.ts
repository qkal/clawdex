import { describe, test, expect } from "bun:test";
import { buildBrowserCommand } from "../src/browser.js";

describe("buildBrowserCommand", () => {
  test("returns platform-appropriate command", () => {
    const url = "http://127.0.0.1:3141/?token=abc";
    const cmd = buildBrowserCommand(url);
    expect(cmd).toBeDefined();
    expect(cmd.length).toBeGreaterThan(0);
    // On Windows it should use "cmd"
    // On Linux it should use "xdg-open"
    if (process.platform === "win32") {
      expect(cmd[0]).toBe("cmd");
    } else {
      expect(cmd[0]).toBe("xdg-open");
    }
  });
});
