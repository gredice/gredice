/**
 * Observability configuration
 */
export interface ObservabilityConfig {
    /**
     * BetterStack DSN URL
     */
    dsn: string;
    /**
     * Enable observability in production only
     * @default true
     */
    productionOnly?: boolean;
    /**
     * Traces sample rate (0.0 to 1.0)
     * @default 1.0
     */
    tracesSampleRate?: number;
    /**
     * Replays session sample rate (0.0 to 1.0)
     * @default 0.1
     */
    replaysSessionSampleRate?: number;
    /**
     * Replays on error sample rate (0.0 to 1.0)
     * @default 1.0
     */
    replaysOnErrorSampleRate?: number;
}
