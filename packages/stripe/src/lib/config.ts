import { isAbsoluteUrl } from '@signalco/js';
import Stripe from 'stripe';

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

export function getReturnUrl(params?: Record<string, string> | string) {
    let url = process.env.NEXT_PUBLIC_STRIPE_RETURN_URL;
    if (url && !isAbsoluteUrl(url)) {
        const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
        if (!baseUrl) {
            throw new Error('VERCEL_PROJECT_PRODUCTION_URL is not defined');
        }
        if (url.startsWith('/')) {
            url = baseUrl + url;
        } else {
            url = `${baseUrl}/${url}`;
        }
    }

    if (!url) {
        throw new Error('NEXT_PUBLIC_STRIPE_RETURN_URL is not defined');
    }

    if (params) {
        let query = '';
        if (typeof params === 'string') {
            query = params.startsWith('?') ? params : `?${params}`;
        } else if (typeof params === 'object') {
            const searchParams = new URLSearchParams(params).toString();
            query = searchParams ? `?${searchParams}` : '';
        }
        if (query) {
            url += url.includes('?') ? `&${query.replace(/^\?/, '')}` : query;
        }
    }
    return url;
}

export function getStripe() {
    if (!stripe) {
        stripe = new Stripe(getSecretKey(), {});
    }
    return stripe;
}
