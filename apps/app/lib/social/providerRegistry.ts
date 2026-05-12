import 'server-only';

import type { SocialProvider, SocialProviderAdapter } from './providerAdapter';
import { RedditProviderAdapter } from './providers/redditProviderAdapter';

const providers: Record<SocialProvider, SocialProviderAdapter> = {
    reddit: new RedditProviderAdapter(),
};

export function getSocialProviderAdapter(
    provider: SocialProvider,
): SocialProviderAdapter {
    return providers[provider];
}
