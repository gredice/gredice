import Stripe from 'stripe';
import { stripeWebhookConstructEvent } from '@gredice/stripe/server';

export const dynamic = 'force-dynamic';

const relevantEvents = new Set([
    // 'product.created',
    // 'product.updated',
    // 'product.deleted',
    // 'price.created',
    // 'price.updated',
    // 'price.deleted',
    'checkout.session.completed'
]);

async function manageCheckoutSession(paymentStatus: Stripe.Checkout.Session.PaymentStatus, customerId?: string, items?: Stripe.ApiList<Stripe.LineItem>) {
    // Here you would typically update your database to reflect the payment status
    // For example, mark the user's subscription as active or update their account status
    console.log(`Payment status for customer ${customerId}: ${paymentStatus}`);
    // Implement your logic here
}

export async function POST(req: Request) {
    const body = await req.text();
    const sig = req.headers.get('stripe-signature') as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const event = await stripeWebhookConstructEvent(body, sig, webhookSecret);

    // Ignore not supported event (check Stripe webhook config)
    if (!relevantEvents.has(event.type)) {
        return new Response(`Unsupported event type: ${event.type}`, {
            status: 400
        });
    }

    try {
        switch (event.type) {
            case 'checkout.session.completed':
                const checkoutSession = event.data.object as Stripe.Checkout.Session;
                if (checkoutSession.mode === 'payment') {
                    await manageCheckoutSession(
                        checkoutSession.payment_status,
                        typeof checkoutSession.customer === 'string'
                            ? checkoutSession.customer
                            : checkoutSession.customer?.id,
                        checkoutSession.line_items
                    );
                }
                break;
            default:
                throw new Error('Unhandled relevant event!');
        }
    } catch (error) {
        console.error('Stripe webhook error', error);
        return new Response(
            'Stripe webhook handler failed',
            {
                status: 400
            }
        );
    }

    return new Response(JSON.stringify({ received: true }));
}