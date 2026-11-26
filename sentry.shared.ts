/**
 * Options shared by the server, edge and browser Sentry.init calls.
 *
 * Tracing is sampled lightly in production: every traced request costs a
 * little Active CPU on the Vercel Hobby plan, and errors are captured in full
 * whatever the trace rate. Without a DSN (local runs, CI, tests) the SDK does
 * nothing.
 */
const isDev = process.env.NODE_ENV === "development";

export const sentryDsn =
  process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN || undefined;

export const sentryEnvironment =
  process.env.NEXT_PUBLIC_VERCEL_ENV ||
  process.env.VERCEL_ENV ||
  process.env.NODE_ENV;

export function traceRate(production: number) {
  return isDev ? 1.0 : production;
}
