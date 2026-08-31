import 'server-only';
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isSupabaseAdminAvailable =
  !!supabaseUrl &&
  !!serviceRoleKey &&
  !supabaseUrl.includes("placeholder");

export const SUPABASE_ADMIN_UNAVAILABLE_MESSAGE =
  "Supabase admin client is unavailable. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.";

// eslint-disable-next-line
type SupabaseAdminClient = SupabaseClient<any, any, any>;

function createUnavailableSupabaseAdmin(): SupabaseAdminClient {
  return {
    from() {
      throw new Error(SUPABASE_ADMIN_UNAVAILABLE_MESSAGE);
    },
  } as unknown as SupabaseAdminClient;
}

export const supabaseAdmin: SupabaseAdminClient =
  isSupabaseAdminAvailable
    ? createClient(supabaseUrl!, serviceRoleKey!)
    : createUnavailableSupabaseAdmin();

/**
 * @deprecated Import directly from the appropriate module instead:
 *
 *   - Server-only (admin/service role):  `@/lib/supabase-admin`
 *   - Browser-safe (anon key):           `@/lib/supabase-browser`
 *
 * This re-export barrel exists for backward compatibility while call sites
 * are migrated. It will be removed in a future release.
 */
export {
  getUserByUsername,
  getUserByGithubId,
  updateUserPublicFlag,
} from "@/lib/supabase-admin";

export {
  supabaseBrowser,
  isBrowserClientAvailable,
  BROWSER_CLIENT_UNAVAILABLE_MESSAGE,
} from "@/lib/supabase-browser";
