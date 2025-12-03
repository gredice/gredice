import { initClientObservability } from '@gredice/observability';

const BETTERSTACK_DSN =
    process.env.NEXT_PUBLIC_BETTERSTACK_DSN ??
    'https://7rxbjiQqGKBd3w9E5f4hP1qu@eu-nbg-2.betterstackdata.com/1582934';

initClientObservability({
    dsn: BETTERSTACK_DSN,
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
});
