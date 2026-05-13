import 'server-only';

import { RedditProviderAdapter } from './reddit/redditAdapter';
import type { SocialProviderAdapter, SocialProviderName } from './types';

export function createSocialProviderAdapter(
    provider: SocialProviderName,
): SocialProviderAdapter {
    switch (provider) {
        case 'reddit':
            return new RedditProviderAdapter();
        default:
            return assertNever(provider);
    }
}

function assertNever(value: never): never {
    throw new Error(`Unsupported provider: ${String(value)}`);
}

export * from './reddit/redditAdapter';
export * from './types';
