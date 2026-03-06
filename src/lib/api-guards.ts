/**
 * Local-only API route guard
 *
 * Used by API routes that depend on server/ modules (PTY, filesystem, etc.).
 * Returns 503 in deployment environments so clients can disable features.
 */
export function requireLocal(): Response | null {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.DB_PROVIDER === "postgresql"
  ) {
    return new Response(
      JSON.stringify({
        error: {
          code: "LOCAL_ONLY",
          message: "This feature is only available in local mode",
          status: 503,
        },
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
  return null;
}
