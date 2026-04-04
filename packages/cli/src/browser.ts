import { spawn } from "node:child_process";

/** Return the command array to open a URL in the default browser. */
export function buildBrowserCommand(url: string): string[] {
  switch (process.platform) {
    case "win32":
      return ["cmd", "/c", "start", "", url];
    case "darwin":
      return ["open", url];
    default:
      return ["xdg-open", url];
  }
}

/** Open a URL in the default browser. Fire and forget. */
export function openBrowser(url: string): void {
  const cmd = buildBrowserCommand(url);
  const child = spawn(cmd[0], cmd.slice(1), {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}
