import { handleStripeWebhook } from '../../../../lib/stripe/stripeWebhook';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export function POST(request: Request) {
    return handleStripeWebhook(request);
}
