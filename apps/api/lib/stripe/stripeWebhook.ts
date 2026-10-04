import {
    releaseStripeCheckoutAttempt,
    StripePaymentProcessingPermanentError,
    StripePaymentProcessingUnavailableError,
} from '@gredice/storage';
import { stripeWebhookConstructEvent } from '@gredice/stripe/server';
import { decodeStripeCheckoutAttemptMetadata } from '../checkout/stripeCheckoutSnapshot';
import { processCheckoutSession } from './processCheckoutSession';
import {
    getStripeCheckoutProcessingMaintenanceResponse,
    isStripeCheckoutProcessingMaintenanceEnabled,
} from './stripeCheckoutProcessingMaintenance';
import { getStripeOperationalErrorDiagnostic } from './stripeOperationalError';

function isPaymentCheckoutSession(value: unknown): value is {
    id: string;
    metadata?: Record<string, string> | null;
    mode: 'payment';
} {
    const metadata =
        value && typeof value === 'object' && 'metadata' in value
            ? value.metadata
            : undefined;
    return (
        !!value &&
        typeof value === 'object' &&
        'id' in value &&
        typeof value.id === 'string' &&
        'mode' in value &&
        value.mode === 'payment' &&
        (metadata === undefined ||
            metadata === null ||
            (typeof metadata === 'object' &&
                !Array.isArray(metadata) &&
                Object.values(metadata).every(
                    (entry) => typeof entry === 'string',
                )))
    );
}

const relevantEvents = new Set([
    'checkout.session.completed',
    'checkout.session.expired',
]);

type StripeWebhookDependencies = {
    constructEvent: (
        body: string,
        signature: string,
        webhookSecret?: string,
    ) => Promise<{ data: { object: unknown }; type: string }>;
    maintenanceEnabled: () => boolean;
    process: typeof processCheckoutSession;
    releaseAttempt: (
        input: Parameters<typeof releaseStripeCheckoutAttempt>[0],
    ) => Promise<unknown>;
};

const defaultDependencies: StripeWebhookDependencies = {
    constructEvent: stripeWebhookConstructEvent,
    maintenanceEnabled: isStripeCheckoutProcessingMaintenanceEnabled,
    process: processCheckoutSession,
    releaseAttempt: releaseStripeCheckoutAttempt,
};

function retryableFailureResponse() {
    return new Response('Stripe webhook handler failed', {
        headers: {
            'Cache-Control': 'private, no-store',
            'Retry-After': '60',
        },
        status: 503,
    });
}

export async function handleStripeWebhook(
    request: Request,
    dependencies: Partial<StripeWebhookDependencies> = {},
) {
    const resolved = { ...defaultDependencies, ...dependencies };
    const body = await request.text();
    const signature = request.headers.get('stripe-signature') ?? '';
    let event: Awaited<ReturnType<StripeWebhookDependencies['constructEvent']>>;
    try {
        event = await resolved.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET,
        );
    } catch (error) {
        console.error('Stripe webhook signature validation failed', {
            ...getStripeOperationalErrorDiagnostic(error),
        });
        return new Response('Invalid Stripe webhook signature', {
            headers: { 'Cache-Control': 'private, no-store' },
            status: 400,
        });
    }

    if (!relevantEvents.has(event.type)) {
        return new Response(`Unsupported event type: ${event.type}`, {
            headers: { 'Cache-Control': 'private, no-store' },
            status: 400,
        });
    }

    try {
        const checkoutSession = event.data.object;
        if (isPaymentCheckoutSession(checkoutSession)) {
            if (event.type === 'checkout.session.completed') {
                if (resolved.maintenanceEnabled()) {
                    return getStripeCheckoutProcessingMaintenanceResponse(
                        'webhook',
                    );
                }
                await resolved.process(checkoutSession.id);
            } else if (event.type === 'checkout.session.expired') {
                const attemptMetadata = decodeStripeCheckoutAttemptMetadata(
                    checkoutSession.metadata,
                );
                if (attemptMetadata) {
                    await resolved.releaseAttempt({
                        ...attemptMetadata,
                        reason: 'expired',
                        sessionId: checkoutSession.id,
                    });
                }
            }
        }
    } catch (error) {
        if (error instanceof StripePaymentProcessingUnavailableError) {
            console.warn(
                'Stripe webhook payment processing is already active',
                {
                    attempt: error.attempt,
                    availableAt: error.availableAt?.toISOString() ?? null,
                    claimStatus: error.claimStatus,
                    stripePaymentId: error.stripePaymentId,
                },
            );
            return retryableFailureResponse();
        }
        if (error instanceof StripePaymentProcessingPermanentError) {
            console.error('Stripe webhook payment requires manual review', {
                failureCode: error.failureCode,
            });
            return Response.json(
                { received: true },
                { headers: { 'Cache-Control': 'private, no-store' } },
            );
        }
        console.error('Stripe webhook retryable failure', {
            ...getStripeOperationalErrorDiagnostic(error),
            eventType: event.type,
        });
        return retryableFailureResponse();
    }

    return Response.json(
        { received: true },
        { headers: { 'Cache-Control': 'private, no-store' } },
    );
}
