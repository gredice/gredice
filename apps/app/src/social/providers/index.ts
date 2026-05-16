import 'server-only';

import { GenericConfiguredProviderAdapter } from './genericConfiguredAdapter';
import { RedditProviderAdapter } from './reddit/redditAdapter';
import type { SocialProviderAdapter, SocialProviderName } from './types';

export function createSocialProviderAdapter(
    provider: SocialProviderName,
): SocialProviderAdapter {
    switch (provider) {
        case 'reddit':
            return new RedditProviderAdapter();
        case 'instagram':
        case 'facebook':
        case 'google_business':
        case 'x':
        case 'tiktok':
        case 'threads':
        case 'linkedin':
        case 'whatsapp':
            return new GenericConfiguredProviderAdapter(provider);
        default:
            return assertNever(provider);
    }
}

function assertNever(value: never): never {
    throw new Error(`Unsupported provider: ${String(value)}`);
}

export * from './definitions';
export * from './genericConfiguredAdapter';
export * from './reddit/redditAdapter';
export * from './types';
