import 'server-only';

import type { SocialProviderIntegrationSettingValue } from '@gredice/storage';
import { GenericConfiguredProviderAdapter } from './genericConfiguredAdapter';
import { RedditProviderAdapter } from './reddit/redditAdapter';
import type { SocialProviderAdapter, SocialProviderName } from './types';

export function createSocialProviderAdapter(
    provider: SocialProviderName,
    config: SocialProviderIntegrationSettingValue | undefined,
): SocialProviderAdapter {
    switch (provider) {
        case 'reddit':
            return new RedditProviderAdapter(toRedditConfig(config));
        case 'instagram':
        case 'facebook':
        case 'google_business':
        case 'x':
        case 'tiktok':
        case 'threads':
        case 'linkedin':
        case 'whatsapp':
            return new GenericConfiguredProviderAdapter(
                provider,
                toGenericProviderConfig(config),
            );
        default:
            return assertNever(provider);
    }
}

function toRedditConfig(
    config: SocialProviderIntegrationSettingValue | undefined,
) {
    return {
        enabled: config?.enabled ?? false,
        clientId: config?.clientId?.trim() ?? '',
        clientSecret: config?.clientSecret?.trim() ?? '',
        userAgent: config?.userAgent?.trim() ?? '',
        defaultDestination: config?.defaultDestination?.trim() ?? '',
        allowedDestinations: allowedDestinationSet(config),
    };
}

function toGenericProviderConfig(
    config: SocialProviderIntegrationSettingValue | undefined,
) {
    return {
        enabled: config?.enabled ?? false,
        endpoint: config?.publishEndpoint?.trim() ?? '',
        apiKey: config?.apiKey?.trim() ?? '',
        defaultDestination: config?.defaultDestination?.trim() ?? '',
        allowedDestinations: allowedDestinationSet(config),
    };
}

function allowedDestinationSet(
    config: SocialProviderIntegrationSettingValue | undefined,
) {
    const allowedDestinations = new Set(
        (config?.allowedDestinations ?? [])
            .map((entry) => entry.trim())
            .filter(Boolean),
    );
    const defaultDestination = config?.defaultDestination?.trim();
    if (defaultDestination) {
        allowedDestinations.add(defaultDestination);
    }
    return allowedDestinations;
}

function assertNever(value: never): never {
    throw new Error(`Unsupported provider: ${String(value)}`);
}

export * from './definitions';
export * from './genericConfiguredAdapter';
export * from './reddit/redditAdapter';
export * from './types';
