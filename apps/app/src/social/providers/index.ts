import 'server-only';

import { GoogleBusinessProviderAdapter } from './googleBusiness/googleBusinessAdapter';
import { LinkedInProviderAdapter } from './linkedin/linkedInAdapter';
import { FacebookProviderAdapter } from './meta/facebookAdapter';
import { InstagramProviderAdapter } from './meta/instagramAdapter';
import { ThreadsProviderAdapter } from './meta/threadsAdapter';
import { RedditProviderAdapter } from './reddit/redditAdapter';
import { TikTokProviderAdapter } from './tiktok/tiktokAdapter';
import type { SocialProviderAdapter, SocialProviderName } from './types';
import { WhatsAppProviderAdapter } from './whatsapp/whatsAppAdapter';
import { XProviderAdapter } from './x/xAdapter';

export function createSocialProviderAdapter(
    provider: SocialProviderName,
): SocialProviderAdapter {
    switch (provider) {
        case 'reddit':
            return new RedditProviderAdapter();
        case 'instagram':
            return new InstagramProviderAdapter();
        case 'facebook':
            return new FacebookProviderAdapter();
        case 'google_business':
            return new GoogleBusinessProviderAdapter();
        case 'x':
            return new XProviderAdapter();
        case 'tiktok':
            return new TikTokProviderAdapter();
        case 'threads':
            return new ThreadsProviderAdapter();
        case 'linkedin':
            return new LinkedInProviderAdapter();
        case 'whatsapp':
            return new WhatsAppProviderAdapter();
        default:
            return assertNever(provider);
    }
}

function assertNever(value: never): never {
    throw new Error(`Unsupported provider: ${String(value)}`);
}

export * from './config';
export * from './definitions';
export * from './googleBusiness/googleBusinessAdapter';
export * from './http';
export * from './linkedin/linkedInAdapter';
export * from './meta/facebookAdapter';
export * from './meta/instagramAdapter';
export * from './meta/threadsAdapter';
export * from './reddit/redditAdapter';
export * from './setupGuide';
export * from './tiktok/tiktokAdapter';
export * from './types';
export * from './whatsapp/whatsAppAdapter';
export * from './x/xAdapter';
