import { stripeWebhookConstructEvent } from '@gredice/stripe/server';
import { processCheckoutSession } from '../../../../lib/stripe/processCheckoutSession';

export const dynamic = 'force-dynamic';

function isPaymentCheckoutSession(
    value: unknown,
): value is { id: string; mode: 'payment' } {
    return (
        !!value &&
        typeof value === 'object' &&
        'id' in value &&
        typeof value.id === 'string' &&
        'mode' in value &&
        value.mode === 'payment'
    );
}

const relevantEvents = new Set([
    // 'product.created',
    // 'product.updated',
    // 'product.deleted',
    // 'price.created',
    // 'price.updated',
    // 'price.deleted',
    'checkout.session.completed',
]);

export async function POST(req: Request) {
    const body = await req.text();
    const sig = req.headers.get('stripe-signature') as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const event = await stripeWebhookConstructEvent(body, sig, webhookSecret);

    // Ignore not supported event (check Stripe webhook config)
    if (!relevantEvents.has(event.type)) {
        return new Response(`Unsupported event type: ${event.type}`, {
            status: 400,
        });
    }

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const checkoutSession = event.data.object;
                if (isPaymentCheckoutSession(checkoutSession)) {
                    await processCheckoutSession(checkoutSession.id);
                }
                break;
            }
            default:
                throw new Error('Unhandled relevant event!');
        }
    } catch (error) {
        console.error('Stripe webhook error', error);
        return new Response('Stripe webhook handler failed', {
            status: 400,
        });
    }

    return new Response(JSON.stringify({ received: true }));
}
