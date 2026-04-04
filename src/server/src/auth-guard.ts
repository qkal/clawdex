/**
 * Validate that a provided token matches the server's expected token.
 * Uses constant-time comparison to prevent timing attacks.
 */
export function validateToken(
  expected: string,
  provided: string | undefined | null,
): boolean {
  if (!provided || !expected) return false;
  if (provided.length !== expected.length) return false;

  // Constant-time comparison
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return mismatch === 0;
}

/** Extract the token from a URL's query string (?token=...). */
export function extractTokenFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get("token");
  } catch {
    return null;
  }
}

/** Extract Bearer token from an Authorization header. */
export function extractTokenFromHeader(
  header: string | undefined | null,
): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}
