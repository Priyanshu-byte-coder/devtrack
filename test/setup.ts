process.env.TZ = 'UTC';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
process.env.NEXTAUTH_SECRET = 'test-secret';
process.env.GITHUB_ID = 'test-github-id';
process.env.GITHUB_SECRET = 'test-github-secret';

import { vi } from "vitest";
vi.mock("server-only", () => ({}));

