import { initClientObservability } from '@gredice/observability';

const SENTRY_DSN =
    process.env.NEXT_PUBLIC_SENTRY_DSN ??
    'https://ASVhngZYan19sgPoF9zjorpv@eu-nbg-2.betterstackdata.com/1582372';

initClientObservability({
    dsn: SENTRY_DSN,
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
});
