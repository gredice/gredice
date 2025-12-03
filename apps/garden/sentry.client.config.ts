import { initClientObservability } from '@gredice/observability';

const BETTERSTACK_DSN =
    process.env.NEXT_PUBLIC_BETTERSTACK_DSN ??
    'https://mNGQ8VdLkzFb2PGEY9vDfj8T@eu-nbg-2.betterstackdata.com/1582928';

initClientObservability({
    dsn: BETTERSTACK_DSN,
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
});
