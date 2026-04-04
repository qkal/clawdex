export interface CallbackServerResult {
  port: number;
  stop: () => void;
  /** Resolves with the authorization code when the callback is received. */
  codePromise: Promise<string>;
}

/**
 * Start a temporary localhost HTTP server to receive the OAuth callback.
 * It listens on a random port and waits for a single /callback?code=... request.
 */
export async function startCallbackServer(): Promise<CallbackServerResult> {
  let resolveCode!: (code: string) => void;
  const codePromise = new Promise<string>((resolve) => {
    resolveCode = resolve;
  });

  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0, // random port
    fetch(req) {
      const url = new URL(req.url);

      if (url.pathname === "/callback") {
        const code = url.searchParams.get("code");
        if (!code) {
          return new Response(
            "<html><body><h1>Error</h1><p>Missing authorization code.</p></body></html>",
            { status: 400, headers: { "Content-Type": "text/html" } },
          );
        }

        resolveCode(code);
        return new Response(
          "<html><body><h1>Login successful!</h1><p>You can close this tab and return to Clawdex.</p></body></html>",
          { headers: { "Content-Type": "text/html" } },
        );
      }

      return new Response("Not Found", { status: 404 });
    },
  });

  return {
    port: server.port!,
    stop: () => server.stop(),
    codePromise,
  };
}
