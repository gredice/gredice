import type { Env, MiddlewareHandler } from 'hono';

export type CheckoutTimingPhase =
    | 'account_cart_load'
    | 'analytics'
    | 'cart_enrichment'
    | 'cart_normalization'
    | 'confirmation_side_effects'
    | 'delivery_validation'
    | 'non_stripe_fulfillment'
    | 'stripe_session';

export type CheckoutPaymentKind =
    | 'inventory'
    | 'mixed_non_stripe'
    | 'stripe'
    | 'sunflower'
    | 'unknown';

export type CheckoutTimingOutcome =
    | 'failed'
    | 'rejected'
    | 'success'
    | 'unexpected_failure';

export type CheckoutTimingErrorCategory =
    | 'sunflower_spend_failed'
    | 'unexpected';

type CheckoutTimingLevel = 'error' | 'info';

type CheckoutTimingAttributes = {
    accountCartLoadDurationMs?: number;
    analyticsDurationMs?: number;
    cartEnrichmentDurationMs?: number;
    cartNormalizationDurationMs?: number;
    confirmationSideEffectsDurationMs?: number;
    deliveryValidationDurationMs?: number;
    errorCategory?: CheckoutTimingErrorCategory;
    itemCountBucket: string;
    nonStripeFulfillmentDurationMs?: number;
    outcome: CheckoutTimingOutcome;
    paymentKind: CheckoutPaymentKind;
    route: '/api/checkout/checkout';
    statusCode: number;
    stripeSessionDurationMs?: number;
    totalDurationMs: number;
};

type CheckoutDurationAttributeName =
    | 'accountCartLoadDurationMs'
    | 'analyticsDurationMs'
    | 'cartEnrichmentDurationMs'
    | 'cartNormalizationDurationMs'
    | 'confirmationSideEffectsDurationMs'
    | 'deliveryValidationDurationMs'
    | 'nonStripeFulfillmentDurationMs'
    | 'stripeSessionDurationMs';

type CheckoutTimingWriter = (
    level: CheckoutTimingLevel,
    event: string,
    attributes: CheckoutTimingAttributes,
) => void;

export type CheckoutTimingOptions = {
    now?: () => number;
    write?: CheckoutTimingWriter;
};

export type CheckoutTimingVariables = {
    checkoutTiming: CheckoutTiming;
};

const checkoutTimingEvent = 'checkout.request.complete';

const checkoutTimingPhases: CheckoutTimingPhase[] = [
    'account_cart_load',
    'analytics',
    'cart_enrichment',
    'cart_normalization',
    'confirmation_side_effects',
    'delivery_validation',
    'non_stripe_fulfillment',
    'stripe_session',
];

const phaseAttributeNames: Record<
    CheckoutTimingPhase,
    CheckoutDurationAttributeName
> = {
    account_cart_load: 'accountCartLoadDurationMs',
    analytics: 'analyticsDurationMs',
    cart_enrichment: 'cartEnrichmentDurationMs',
    cart_normalization: 'cartNormalizationDurationMs',
    confirmation_side_effects: 'confirmationSideEffectsDurationMs',
    delivery_validation: 'deliveryValidationDurationMs',
    non_stripe_fulfillment: 'nonStripeFulfillmentDurationMs',
    stripe_session: 'stripeSessionDurationMs',
};

function roundedDuration(value: number) {
    return Math.round(Math.max(0, value) * 10) / 10;
}

function defaultWriter(
    level: CheckoutTimingLevel,
    event: string,
    attributes: CheckoutTimingAttributes,
) {
    if (level === 'error') {
        console.error(event, attributes);
        return;
    }

    console.info(event, attributes);
}

export function checkoutItemCountBucket(itemCount: number) {
    if (itemCount <= 0) return '0';
    if (itemCount === 1) return '1';
    if (itemCount <= 3) return '2-3';
    if (itemCount <= 10) return '4-10';
    return '11+';
}

export function checkoutOutcomeFromStatus(
    status: number,
): CheckoutTimingOutcome {
    if (status >= 500) return 'failed';
    if (status >= 400) return 'rejected';
    return 'success';
}

export class CheckoutTiming {
    private errorCategory: CheckoutTimingErrorCategory | undefined;
    private finished = false;
    private itemCountBucket = 'unknown';
    private readonly now: () => number;
    private paymentKind: CheckoutPaymentKind = 'unknown';
    private readonly phaseDurationsMs: Partial<
        Record<CheckoutTimingPhase, number>
    > = {};
    private readonly startedAtMs: number;
    private readonly write: CheckoutTimingWriter;

    constructor({
        now = performance.now.bind(performance),
        write,
    }: CheckoutTimingOptions = {}) {
        this.now = now;
        this.write = write ?? defaultWriter;
        this.startedAtMs = this.now();
    }

    setContext({
        itemCount,
        paymentKind,
    }: {
        itemCount?: number;
        paymentKind?: CheckoutPaymentKind;
    }) {
        if (typeof itemCount === 'number') {
            this.itemCountBucket = checkoutItemCountBucket(itemCount);
        }
        if (paymentKind) {
            this.paymentKind = paymentKind;
        }
    }

    setErrorCategory(errorCategory: CheckoutTimingErrorCategory) {
        this.errorCategory = errorCategory;
    }

    startPhase(phase: CheckoutTimingPhase) {
        const startedAtMs = this.now();
        let ended = false;

        return () => {
            if (ended) return;
            ended = true;
            const durationMs = roundedDuration(this.now() - startedAtMs);
            this.phaseDurationsMs[phase] = roundedDuration(
                (this.phaseDurationsMs[phase] ?? 0) + durationMs,
            );
        };
    }

    async measure<T>(phase: CheckoutTimingPhase, action: () => Promise<T>) {
        const end = this.startPhase(phase);
        try {
            return await action();
        } finally {
            end();
        }
    }

    finish({
        outcome,
        status,
    }: {
        outcome?: CheckoutTimingOutcome;
        status: number;
    }) {
        if (this.finished) return false;
        this.finished = true;

        const finalOutcome = outcome ?? checkoutOutcomeFromStatus(status);
        const attributes: CheckoutTimingAttributes = {
            itemCountBucket: this.itemCountBucket,
            outcome: finalOutcome,
            paymentKind: this.paymentKind,
            route: '/api/checkout/checkout',
            statusCode: status,
            totalDurationMs: roundedDuration(this.now() - this.startedAtMs),
            ...(this.errorCategory
                ? { errorCategory: this.errorCategory }
                : {}),
        };
        for (const phase of checkoutTimingPhases) {
            const durationMs = this.phaseDurationsMs[phase];
            if (durationMs !== undefined) {
                attributes[phaseAttributeNames[phase]] = durationMs;
            }
        }
        this.write(
            finalOutcome === 'unexpected_failure' || finalOutcome === 'failed'
                ? 'error'
                : 'info',
            checkoutTimingEvent,
            attributes,
        );
        return true;
    }
}

export function checkoutTimingMiddleware<
    E extends Env & { Variables: CheckoutTimingVariables },
>(options?: CheckoutTimingOptions): MiddlewareHandler<E> {
    return async (context, next) => {
        const checkoutTiming = new CheckoutTiming(options);
        context.set('checkoutTiming', checkoutTiming);

        try {
            await next();
            if (context.error) {
                checkoutTiming.setErrorCategory('unexpected');
                checkoutTiming.finish({
                    outcome: 'unexpected_failure',
                    status: context.res.status,
                });
                return;
            }
            checkoutTiming.finish({ status: context.res.status });
        } catch (error) {
            checkoutTiming.setErrorCategory('unexpected');
            checkoutTiming.finish({
                outcome: 'unexpected_failure',
                status: 500,
            });
            throw error;
        }
    };
}
