import Stripe from 'stripe';

let stripe: Stripe | null = null;

export function getDomain() {
    const url = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;
    if (!url) {
        throw new Error('NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL is not defined');
    }
    return url;
}

export function getReturnUrl() {
    const url = process.env.NEXT_PUBLIC_VERCEL_PROJECT_RETURN_URL;
    if (!url) {
        throw new Error('NEXT_PUBLIC_VERCEL_PROJECT_RETURN_URL is not defined');
    }
    return url;
}

export function getStripe() {
    if (!stripe) {
        stripe = new Stripe(
            process.env.STRIPE_SECRETKEY ?? '',
            {
            }
        );
    }
    return stripe;
}
