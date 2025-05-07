import { loadStripe, Stripe } from '@stripe/stripe-js';

let stripePromise: Promise<Stripe | null>;

export function clientStripe() {
    if (!stripePromise) {
        const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE;
        if (!publishableKey) {
            throw new Error('Missing Stripe publishable key');
        }
        stripePromise = loadStripe(publishableKey);
    }

    return stripePromise;
}