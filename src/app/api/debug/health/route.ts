import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Debug health endpoint — only enabled when ENABLE_DEBUG_ENDPOINT=true
 * AND the caller supplies the correct Authorization: Bearer <DEBUG_SECRET>.
 *
 * Access control layers:
 *   1. ENABLE_DEBUG_ENDPOINT must be exactly "true" (env-var gate).
 *   2. DEBUG_SECRET must be configured in the environment.
 *   3. The request must supply Authorization: Bearer <DEBUG_SECRET>.
 *
 * If all three pass, the endpoint returns non-sensitive operational state:
 *   - timestamp
 *   - database connectivity status (boolean + error message on failure)
 *   - whether the caller holds a valid session (boolean only)
 *
 * What is deliberately NOT returned:
 *   - secret presence indicators (NEXTAUTH_SECRET, SUPABASE_SERVICE_ROLE_KEY, etc.)
 *   - any part of session token or JWT
 *   - githubId or githubLogin — these are account identifiers
 *
 * IMPORTANT: Never enable in production without also setting DEBUG_SECRET
 * to a strong randomly-generated value.
 */
export async function GET(req: NextRequest) {
  // ── Gate 1: feature flag ─────────────────────────────────────────────────
  if (process.env.ENABLE_DEBUG_ENDPOINT !== "true") {
    return NextResponse.json(
      { error: "Debug endpoint is disabled" },
      { status: 403 }
    );
  }

  // ── Gate 2: mandatory debug secret ──────────────────────────────────────
  // Requiring a secret means the endpoint cannot be probed by an attacker
  // who simply discovers the URL. ENABLE_DEBUG_ENDPOINT alone is not
  // sufficient access control for a remotely reachable endpoint.
  const debugSecret = process.env.DEBUG_SECRET;
  if (!debugSecret) {
    // Fail closed: if DEBUG_SECRET is not configured the endpoint must not
    // serve diagnostic data even if ENABLE_DEBUG_ENDPOINT is true.
    return NextResponse.json(
      { error: "Debug endpoint is not configured correctly" },
      { status: 403 }
    );
  }

  // ── Gate 3: Bearer token validation ─────────────────────────────────────
  const authHeader = req.headers.get("authorization");
  const provided = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  // Constant-time comparison is not critical here because the endpoint is
  // already hidden behind the feature flag, but a simple equality check is
  // still the right idiom.
  if (!provided || provided !== debugSecret) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  // ── Operational diagnostics (non-sensitive) ──────────────────────────────
  try {
    // Database connectivity check
    let dbHealthy = true;
    let dbError: string | null = null;

    try {
      const { error } = await supabaseAdmin
        .from("users")
        .select("id")
        .limit(1);

      if (error) {
        dbHealthy = false;
        dbError = error.message;
      }
    } catch (err) {
      dbHealthy = false;
      dbError = err instanceof Error ? err.message : String(err);
    }

    // Session check — return only a boolean; never expose account identifiers
    // (githubId, githubLogin) because this endpoint is reachable by anyone
    // who holds the DEBUG_SECRET, which may differ from the account owner.
    const session = await getServerSession(authOptions);

    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      database: {
        healthy: dbHealthy,
        error: dbError,
      },
      session: {
        // Indicates whether the HTTP client making this request also holds a
        // valid user session. No account identifiers are included.
        authenticated: session !== null,
      },
    });
  } catch (error) {
    console.error("Error in debug health endpoint:", error);
    return NextResponse.json(
      { error: "Failed to generate debug report" },
      { status: 500 }
    );
  }
}
