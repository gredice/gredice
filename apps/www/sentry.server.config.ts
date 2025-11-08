import { initServerObservability } from '@gredice/observability';

const SENTRY_DSN =
    process.env.SENTRY_DSN ??
    process.env.NEXT_PUBLIC_SENTRY_DSN ??
    'https://ASVhngZYan19sgPoF9zjorpv@eu-nbg-2.betterstackdata.com/1582372';

initServerObservability({
    dsn: SENTRY_DSN,
    tracesSampleRate: 1.0,
});
