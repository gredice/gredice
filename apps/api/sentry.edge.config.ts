import { initEdgeObservability } from '@gredice/observability';

const BETTERSTACK_DSN =
    process.env.BETTERSTACK_DSN ??
    process.env.NEXT_PUBLIC_BETTERSTACK_DSN ??
    'https://7rxbjiQqGKBd3w9E5f4hP1qu@eu-nbg-2.betterstackdata.com/1582934';

initEdgeObservability({
    dsn: BETTERSTACK_DSN,
    tracesSampleRate: 1.0,
});
