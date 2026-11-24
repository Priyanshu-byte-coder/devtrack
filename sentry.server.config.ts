import * as Sentry from "@sentry/nextjs";
import { sentryDsn, sentryEnvironment, traceRate } from "./sentry.shared";

Sentry.init({
  dsn: sentryDsn,
  environment: sentryEnvironment,
  tracesSampleRate: traceRate(0.05),
  enableLogs: true,
  integrations: [
    Sentry.consoleLoggingIntegration({ levels: ["warn", "error"] }),
  ],
});
