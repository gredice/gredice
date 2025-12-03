import { initClientObservability } from '@gredice/observability';

const BETTERSTACK_DSN =
    process.env.NEXT_PUBLIC_BETTERSTACK_DSN ??
    'https://nfQYZvefATRo5ArUMQoTsmtk@eu-nbg-2.betterstackdata.com/1582932';

initClientObservability({
    dsn: BETTERSTACK_DSN,
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
});
