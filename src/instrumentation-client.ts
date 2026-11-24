import * as Sentry from "@sentry/nextjs";
import { sentryDsn, sentryEnvironment, traceRate } from "../sentry.shared";

Sentry.init({
  dsn: sentryDsn,
  environment: sentryEnvironment,
  tracesSampleRate: traceRate(0.1),
  enableLogs: true,
  integrations: [Sentry.replayIntegration()],
  // Record a replay only when a session hits an error, not every visit.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
