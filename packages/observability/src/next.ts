import * as Sentry from '@sentry/nextjs';
import type { ObservabilityConfig } from './types';

/**
 * Initialize BetterStack observability for Next.js server runtime
 */
export function initServerObservability(config: ObservabilityConfig): void {
    const { dsn, productionOnly = true, tracesSampleRate = 1.0 } = config;

    Sentry.init({
        dsn,
        tracesSampleRate,
        enabled: productionOnly ? process.env.NODE_ENV === 'production' : true,
    });
}

/**
 * Initialize BetterStack observability for Next.js client runtime
 */
export function initClientObservability(config: ObservabilityConfig): void {
    const {
        dsn,
        productionOnly = true,
        tracesSampleRate = 1.0,
        replaysSessionSampleRate = 0.1,
        replaysOnErrorSampleRate = 1.0,
    } = config;

    Sentry.init({
        dsn,
        tracesSampleRate,
        replaysSessionSampleRate,
        replaysOnErrorSampleRate,
        enabled: productionOnly ? process.env.NODE_ENV === 'production' : true,
    });
}

/**
 * Initialize BetterStack observability for Next.js edge runtime
 */
export function initEdgeObservability(config: ObservabilityConfig): void {
    const { dsn, productionOnly = true, tracesSampleRate = 1.0 } = config;

    Sentry.init({
        dsn,
        tracesSampleRate,
        enabled: productionOnly ? process.env.NODE_ENV === 'production' : true,
    });
}
