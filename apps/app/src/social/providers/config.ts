import 'server-only';

import type { SocialProviderName } from './types';

export type SocialProviderRuntimeConfig = {
    enabled: boolean;
    defaultDestination: string;
    allowedDestinations: Set<string>;
};

export type SocialProviderEnvOptions = {
    providerAccountKey?: string;
    env?: Record<string, string | undefined>;
};

function parseCsvList(value: string): Set<string> {
    return new Set(
        value
            .split(',')
            .map((entry) => entry.trim())
            .filter(Boolean),
    );
}

function providerEnvKey(provider: SocialProviderName) {
    return provider.toUpperCase();
}

function accountEnvKey(providerAccountKey: string | undefined) {
    if (!providerAccountKey) return '';
    return providerAccountKey
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

export function socialProviderEnvVar(
    provider: SocialProviderName,
    field: string,
    providerAccountKey?: string,
) {
    const accountKey = accountEnvKey(providerAccountKey);
    const providerKey = providerEnvKey(provider);
    return accountKey
        ? `SOCIAL_PROVIDER_${providerKey}_${accountKey}_${field}`
        : `SOCIAL_PROVIDER_${providerKey}_${field}`;
}

export function readSocialProviderEnv(
    provider: SocialProviderName,
    field: string,
    { providerAccountKey, env = process.env }: SocialProviderEnvOptions = {},
) {
    const accountSpecificKey = socialProviderEnvVar(
        provider,
        field,
        providerAccountKey,
    );
    const accountSpecificValue = providerAccountKey
        ? env[accountSpecificKey]
        : undefined;
    if (accountSpecificValue !== undefined) {
        return accountSpecificValue.trim();
    }

    return (env[socialProviderEnvVar(provider, field)] ?? '').trim();
}

export function readSocialProviderRuntimeConfig(
    provider: SocialProviderName,
    options: SocialProviderEnvOptions = {},
): SocialProviderRuntimeConfig {
    const defaultDestination = readSocialProviderEnv(
        provider,
        'DEFAULT_DESTINATION',
        options,
    );
    const allowedDestinations = parseCsvList(
        readSocialProviderEnv(provider, 'ALLOWED_DESTINATIONS', options),
    );
    if (defaultDestination) {
        allowedDestinations.add(defaultDestination);
    }

    return {
        enabled: readSocialProviderEnv(provider, 'ENABLED', options) === 'true',
        defaultDestination,
        allowedDestinations,
    };
}

export function resolveConfiguredDestination(
    provider: SocialProviderName,
    destination: string | undefined,
    config: SocialProviderRuntimeConfig,
) {
    const resolvedDestination =
        destination?.trim() || config.defaultDestination;
    if (!resolvedDestination) {
        return {
            ok: false as const,
            code: 'invalid_destination' as const,
            message: `${provider} destination is required.`,
        };
    }
    if (
        config.allowedDestinations.size > 0 &&
        !config.allowedDestinations.has(resolvedDestination)
    ) {
        return {
            ok: false as const,
            code: 'invalid_destination' as const,
            message: `${provider} destination is not allowed.`,
        };
    }

    return { ok: true as const, destination: resolvedDestination };
}
