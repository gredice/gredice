import 'server-only';

import type {
    SocialPostInput,
    SocialProviderAdapter,
    SocialPublishError,
    SocialPublishResult,
} from '../types';

type RedditEnv = {
    enabled: boolean;
    clientId: string;
    clientSecret: string;
    userAgent: string;
    defaultDestination: string;
    allowedDestinations: Set<string>;
};

type FetchLike = typeof fetch;

function parseCsvList(value: string): Set<string> {
    return new Set(
        value
            .split(',')
            .map((entry) => entry.trim())
            .filter(Boolean),
    );
}

export function readRedditEnv(env = process.env): RedditEnv {
    const defaultDestination = (
        env.SOCIAL_PROVIDER_REDDIT_DEFAULT_DESTINATION ?? ''
    ).trim();
    const allowed = parseCsvList(
        env.SOCIAL_PROVIDER_REDDIT_ALLOWED_DESTINATIONS ?? '',
    );
    if (defaultDestination) {
        allowed.add(defaultDestination);
    }

    return {
        enabled: (env.SOCIAL_PROVIDER_REDDIT_ENABLED ?? 'false') === 'true',
        clientId: (env.SOCIAL_PROVIDER_REDDIT_CLIENT_ID ?? '').trim(),
        clientSecret: (env.SOCIAL_PROVIDER_REDDIT_CLIENT_SECRET ?? '').trim(),
        userAgent: (env.SOCIAL_PROVIDER_REDDIT_USER_AGENT ?? '').trim(),
        defaultDestination,
        allowedDestinations: allowed,
    };
}

export class RedditProviderAdapter implements SocialProviderAdapter {
    readonly name = 'reddit' as const;

    constructor(
        private readonly config = readRedditEnv(),
        private readonly fetchImpl: FetchLike = fetch,
    ) {}

    validateConfig(): SocialPublishError | null {
        if (!this.config.enabled) {
            return {
                ok: false,
                code: 'provider_disabled',
                message: 'Reddit provider is disabled.',
                retriable: false,
            };
        }
        if (
            !this.config.clientId ||
            !this.config.clientSecret ||
            !this.config.userAgent
        ) {
            return {
                ok: false,
                code: 'missing_credentials',
                message: 'Reddit provider credentials are missing.',
                retriable: false,
            };
        }
        if (!this.config.defaultDestination) {
            return {
                ok: false,
                code: 'invalid_destination',
                message: 'Reddit default destination is not configured.',
                retriable: false,
            };
        }
        if (!this.config.allowedDestinations.size) {
            return {
                ok: false,
                code: 'invalid_destination',
                message: 'Reddit destination allowlist is empty.',
                retriable: false,
            };
        }
        return null;
    }

    async publishPost(input: SocialPostInput): Promise<SocialPublishResult> {
        const configError = this.validateConfig();
        if (configError) return configError;

        const destination = (
            input.destination ?? this.config.defaultDestination
        ).replace(/^r\//, '');
        if (!this.config.allowedDestinations.has(destination)) {
            return {
                ok: false,
                code: 'invalid_destination',
                message: 'Destination subreddit is not allowed.',
                retriable: false,
            };
        }

        const token = await this.getAccessToken();
        if (!token.ok) return token;

        const kind = input.url ? 'link' : 'self';
        const body = new URLSearchParams({
            api_type: 'json',
            kind,
            sr: destination,
            title: input.title,
            ...(input.url ? { url: input.url } : { text: input.body ?? '' }),
        });

        const response = await this.fetchImpl(
            'https://oauth.reddit.com/api/submit',
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token.accessToken}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': this.config.userAgent,
                },
                body,
            },
        );

        const data = (await response.json()) as {
            json?: {
                errors?: unknown[][];
                data?: { id?: string; name?: string; url?: string };
            };
        };
        const apiErrors = data.json?.errors ?? [];
        if (!response.ok || apiErrors.length > 0) {
            return this.mapSubmitError(response.status, apiErrors);
        }

        const id = data.json?.data?.id;
        const permalink = data.json?.data?.url;
        if (!id || !permalink) {
            return {
                ok: false,
                code: 'provider_unavailable',
                message: 'Reddit publish succeeded without post metadata.',
                retriable: true,
            };
        }

        return {
            ok: true,
            providerPostId: id,
            permalink: permalink.startsWith('http')
                ? permalink
                : `https://reddit.com${permalink}`,
            metadata: {
                destination,
                name: data.json?.data?.name ?? null,
                kind,
            },
        };
    }

    private async getAccessToken(): Promise<
        { ok: true; accessToken: string } | SocialPublishError
    > {
        const credentials = Buffer.from(
            `${this.config.clientId}:${this.config.clientSecret}`,
        ).toString('base64');
        const response = await this.fetchImpl(
            'https://www.reddit.com/api/v1/access_token',
            {
                method: 'POST',
                headers: {
                    Authorization: `Basic ${credentials}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': this.config.userAgent,
                },
                body: new URLSearchParams({ grant_type: 'client_credentials' }),
            },
        );

        if (!response.ok) {
            return response.status === 401 || response.status === 403
                ? {
                      ok: false,
                      code: 'auth_failed',
                      message: 'Reddit authentication failed.',
                      retriable: false,
                  }
                : {
                      ok: false,
                      code: 'provider_unavailable',
                      message: 'Reddit authentication is unavailable.',
                      retriable: true,
                  };
        }

        const payload = (await response.json()) as { access_token?: string };
        if (!payload.access_token) {
            return {
                ok: false,
                code: 'provider_unavailable',
                message: 'Reddit authentication returned an empty token.',
                retriable: true,
            };
        }

        return { ok: true, accessToken: payload.access_token };
    }

    private mapSubmitError(
        status: number,
        errors: unknown[][],
    ): SocialPublishError {
        if (status === 401 || status === 403)
            return {
                ok: false,
                code: 'auth_failed',
                message: 'Reddit rejected provider authentication.',
                retriable: false,
            };
        if (status === 429)
            return {
                ok: false,
                code: 'rate_limited',
                message: 'Reddit rate limit reached. Try again later.',
                retriable: true,
            };
        const firstError = errors[0]?.[0];
        if (
            typeof firstError === 'string' &&
            firstError.toUpperCase().includes('SUBREDDIT')
        ) {
            return {
                ok: false,
                code: 'invalid_destination',
                message: 'Reddit destination subreddit is not permitted.',
                retriable: false,
            };
        }
        if (status >= 500)
            return {
                ok: false,
                code: 'provider_unavailable',
                message: 'Reddit is temporarily unavailable.',
                retriable: true,
            };
        return {
            ok: false,
            code: 'invalid_request',
            message: 'Reddit rejected the post payload.',
            retriable: false,
        };
    }
}
