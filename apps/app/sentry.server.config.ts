import { initServerObservability } from '@gredice/observability';

const BETTERSTACK_DSN =
    process.env.BETTERSTACK_DSN ??
    process.env.NEXT_PUBLIC_BETTERSTACK_DSN ??
    'https://qrkQpWogYZeHrKNDBniiGSnr@eu-nbg-2.betterstackdata.com/1582930';

initServerObservability({
    dsn: BETTERSTACK_DSN,
    tracesSampleRate: 1.0,
});
