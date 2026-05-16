import 'server-only';

import type {
    SocialPostInput,
    SocialProviderAdapter,
    SocialProviderName,
    SocialPublishError,
    SocialPublishResult,
} from './types';

type FetchLike = typeof fetch;

type GenericProviderConfig = {
    enabled: boolean;
    endpoint: string;
    apiKey: string;
    defaultDestination: string;
    allowedDestinations: Set<string>;
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

export function readConfiguredSocialProviderEnv(
    provider: SocialProviderName,
    env: Record<string, string | undefined> = process.env,
): GenericProviderConfig {
    const envKey = providerEnvKey(provider);
    const defaultDestination = (
        env[`SOCIAL_PROVIDER_${envKey}_DEFAULT_DESTINATION`] ?? ''
    ).trim();
    const allowedDestinations = parseCsvList(
        env[`SOCIAL_PROVIDER_${envKey}_ALLOWED_DESTINATIONS`] ?? '',
    );
    if (defaultDestination) {
        allowedDestinations.add(defaultDestination);
    }

    return {
        enabled: env[`SOCIAL_PROVIDER_${envKey}_ENABLED`] === 'true',
        endpoint: (
            env[`SOCIAL_PROVIDER_${envKey}_PUBLISH_ENDPOINT`] ?? ''
        ).trim(),
        apiKey: (env[`SOCIAL_PROVIDER_${envKey}_API_KEY`] ?? '').trim(),
        defaultDestination,
        allowedDestinations,
    };
}

export class GenericConfiguredProviderAdapter implements SocialProviderAdapter {
    readonly name: SocialProviderName;
    private readonly config: GenericProviderConfig;
    private readonly fetchImpl: FetchLike;

    constructor(
        name: SocialProviderName,
        config = readConfiguredSocialProviderEnv(name),
        fetchImpl: FetchLike = fetch,
    ) {
        this.name = name;
        this.config = config;
        this.fetchImpl = fetchImpl;
    }

    validateConfig(): SocialPublishError | null {
        if (!this.config.enabled) {
            return {
                ok: false,
                code: 'provider_disabled',
                message: `${this.name} provider is disabled.`,
                retriable: false,
            };
        }
        if (!this.config.endpoint) {
            return {
                ok: false,
                code: 'missing_credentials',
                message: `${this.name} publish endpoint is missing.`,
                retriable: false,
            };
        }

        return null;
    }

    async publishPost(input: SocialPostInput): Promise<SocialPublishResult> {
        const configError = this.validateConfig();
        if (configError) return configError;

        const destination =
            input.destination?.trim() || this.config.defaultDestination;
        if (!destination) {
            return {
                ok: false,
                code: 'invalid_destination',
                message: `${this.name} destination is required.`,
                retriable: false,
            };
        }
        if (
            this.config.allowedDestinations.size &&
            !this.config.allowedDestinations.has(destination)
        ) {
            return {
                ok: false,
                code: 'invalid_destination',
                message: `${this.name} destination is not allowed.`,
                retriable: false,
            };
        }

        let response: Response;
        try {
            response = await this.fetchImpl(this.config.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.config.apiKey
                        ? { Authorization: `Bearer ${this.config.apiKey}` }
                        : {}),
                },
                body: JSON.stringify({
                    provider: this.name,
                    providerAccountKey: input.providerAccountKey,
                    destination,
                    postType: input.postType,
                    title: input.title,
                    body: input.body,
                    url: input.url,
                    mediaUrls: input.mediaUrls ?? [],
                }),
            });
        } catch (error) {
            return providerUnavailable(
                `${this.name} publish request failed.`,
                error,
            );
        }

        const payload = await readJsonResponse(response);
        if (!response.ok) {
            return mapProviderResponseError(
                this.name,
                response.status,
                payload,
            );
        }

        const providerPostId =
            getString(payload, 'providerPostId') ?? getString(payload, 'id');
        const permalink =
            getString(payload, 'permalink') ?? getString(payload, 'url');
        if (!providerPostId) {
            return {
                ok: false,
                code: 'provider_unavailable',
                message: `${this.name} publish succeeded without post id.`,
                retriable: true,
            };
        }

        return {
            ok: true,
            providerPostId,
            permalink: permalink ?? '',
            metadata: {
                provider: this.name,
                destination,
                responseMetadata: getRecord(payload, 'metadata'),
            },
        };
    }
}

async function readJsonResponse(response: Response): Promise<unknown> {
    try {
        return await response.json();
    } catch {
        return null;
    }
}

function mapProviderResponseError(
    provider: SocialProviderName,
    status: number,
    payload: unknown,
): SocialPublishError {
    if (status === 401 || status === 403) {
        return {
            ok: false,
            code: 'auth_failed',
            message: `${provider} rejected provider authentication.`,
            retriable: false,
            details: providerErrorDetails(status, payload),
        };
    }
    if (status === 429) {
        return {
            ok: false,
            code: 'rate_limited',
            message: `${provider} rate limit reached. Try again later.`,
            retriable: true,
            details: providerErrorDetails(status, payload),
        };
    }
    if (status >= 500) {
        return {
            ok: false,
            code: 'provider_unavailable',
            message: `${provider} is temporarily unavailable.`,
            retriable: true,
            details: providerErrorDetails(status, payload),
        };
    }

    return {
        ok: false,
        code: 'invalid_request',
        message: `${provider} rejected the post payload.`,
        retriable: false,
        details: providerErrorDetails(status, payload),
    };
}

function providerErrorDetails(
    status: number,
    payload: unknown,
): Record<string, unknown> {
    return {
        status,
        providerErrorId: getString(payload, 'providerErrorId'),
        reason: getString(payload, 'reason') ?? getString(payload, 'message'),
    };
}

function providerUnavailable(
    message: string,
    error?: unknown,
): SocialPublishError {
    if (error) {
        console.warn(message, error);
    }
    return {
        ok: false,
        code: 'provider_unavailable',
        message,
        retriable: true,
    };
}

function getString(value: unknown, key: string): string | undefined {
    if (!isRecord(value)) return undefined;
    const field = value[key];
    return typeof field === 'string' && field.trim() ? field.trim() : undefined;
}

function getRecord(
    value: unknown,
    key: string,
): Record<string, unknown> | null {
    if (!isRecord(value)) return null;
    const field = value[key];
    return isRecord(field) ? field : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
