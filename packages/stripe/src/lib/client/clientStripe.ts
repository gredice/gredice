import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { getPublishableKey } from '../config';

let stripePromise: Promise<Stripe | null>;

export function clientStripe() {
    if (!stripePromise) {
        stripePromise = loadStripe(getPublishableKey());
    }

    return stripePromise;
}
