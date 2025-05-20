import Stripe from 'stripe';
import { isAbsoluteUrl } from '@signalco/js';

let stripe: Stripe | null = null;

export function getPublishableKey() {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE;
    if (!key) {
        throw new Error('NEXT_PUBLIC_STRIPE_PUBLISHABLE is not defined');
    }
    return key;
}

export function getSecretKey() {
    const key = process.env.STRIPE_SECRETKEY;
    if (!key) {
        throw new Error('STRIPE_SECRETKEY is not defined');
    }
    return key;
}

export function getReturnUrl() {
    let url = process.env.NEXT_PUBLIC_STRIPE_RETURN_URL;
    if (url && !isAbsoluteUrl(url)) {
        const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
        if (!baseUrl) {
            throw new Error('VERCEL_PROJECT_PRODUCTION_URL is not defined');
        }
        if (url.startsWith('/')) {
            url = baseUrl + url;
        } else {
            url = baseUrl + '/' + url;
        }
    }

    if (!url) {
        throw new Error('NEXT_PUBLIC_STRIPE_RETURN_URL is not defined');
    }
    return url;
}

export function getStripe() {
    if (!stripe) {
        stripe = new Stripe(
            getSecretKey(),
            {
            }
        );
    }
    return stripe;
}
