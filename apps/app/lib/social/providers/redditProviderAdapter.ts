import 'server-only';

import type {
    ProviderPublishError,
    ProviderPublishResult,
    SocialPostInput,
    SocialProviderAdapter,
} from '../providerAdapter';

type RedditConfig = {
    allowedSubreddits: Set<string>;
    clientId: string;
    clientSecret: string;
    password: string;
    username: string;
    userAgent: string;
};

const OAUTH_TOKEN_URL = 'https://www.reddit.com/api/v1/access_token';
const REDDIT_OAUTH_BASE_URL = 'https://oauth.reddit.com';

function sanitizeSubreddit(value: string) {
    return value.trim().replace(/^r\//i, '').toLowerCase();
}

function buildRedditConfig(): RedditConfig | ProviderPublishError {
    const clientId = process.env.REDDIT_CLIENT_ID?.trim();
    const clientSecret = process.env.REDDIT_CLIENT_SECRET?.trim();
    const username = process.env.REDDIT_USERNAME?.trim();
    const password = process.env.REDDIT_PASSWORD?.trim();
    const userAgent = process.env.REDDIT_USER_AGENT?.trim();
    const allowedSubredditsRaw = process.env.REDDIT_ALLOWED_SUBREDDITS?.trim();

    if (!clientId || !clientSecret || !username || !password || !userAgent) {
        return {
            code: 'INVALID_CONFIG',
            message: 'Reddit provider credentials are not fully configured.',
            retryable: false,
        };
    }

    const allowedSubreddits = new Set(
        (allowedSubredditsRaw ?? '')
            .split(',')
            .map(sanitizeSubreddit)
            .filter(Boolean),
    );

    if (allowedSubreddits.size === 0) {
        return {
            code: 'INVALID_CONFIG',
            message:
                'Reddit allowlist is empty. Configure REDDIT_ALLOWED_SUBREDDITS.',
            retryable: false,
        };
    }

    return {
        allowedSubreddits,
        clientId,
        clientSecret,
        password,
        username,
        userAgent,
    };
}

async function getAccessToken(
    config: RedditConfig,
): Promise<string | ProviderPublishError> {
    const body = new URLSearchParams({
        grant_type: 'password',
        password: config.password,
        username: config.username,
    });

    const response = await fetch(OAUTH_TOKEN_URL, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': config.userAgent,
        },
        body,
        cache: 'no-store',
    });

    if (!response.ok) {
        return {
            code:
                response.status === 401 || response.status === 403
                    ? 'AUTH_FAILED'
                    : 'PROVIDER_UNAVAILABLE',
            message: 'Unable to authenticate with Reddit provider.',
            retryable: response.status >= 500,
        };
    }

    const tokenResult = (await response.json()) as { access_token?: string };
    if (!tokenResult.access_token) {
        return {
            code: 'AUTH_FAILED',
            message: 'Reddit authentication did not return access token.',
            retryable: false,
        };
    }

    return tokenResult.access_token;
}

function mapRedditError(reason: string | undefined): ProviderPublishError {
    if (reason === 'RATELIMIT') {
        return {
            code: 'RATE_LIMITED',
            message: 'Reddit rate limit reached.',
            retryable: true,
        };
    }

    if (reason === 'SUBREDDIT_NOTALLOWED') {
        return {
            code: 'REQUEST_REJECTED',
            message:
                'Reddit account is not allowed to post to the selected subreddit.',
            retryable: false,
        };
    }

    return {
        code: 'REQUEST_REJECTED',
        message: 'Reddit rejected publish request.',
        retryable: false,
    };
}

export class RedditProviderAdapter implements SocialProviderAdapter {
    readonly provider = 'reddit' as const;

    validateConfig(): ProviderPublishResult | null {
        const config = buildRedditConfig();
        if ('code' in config) {
            return { ok: false, provider: this.provider, error: config };
        }

        return null;
    }

    async publishNow(input: SocialPostInput): Promise<ProviderPublishResult> {
        const config = buildRedditConfig();
        if ('code' in config) {
            return { ok: false, provider: this.provider, error: config };
        }

        const subreddit = sanitizeSubreddit(input.subreddit);
        if (!config.allowedSubreddits.has(subreddit)) {
            return {
                ok: false,
                provider: this.provider,
                error: {
                    code: 'SUBREDDIT_NOT_ALLOWED',
                    message: 'Subreddit is not in REDDIT_ALLOWED_SUBREDDITS.',
                    retryable: false,
                },
            };
        }

        const tokenOrError = await getAccessToken(config);
        if (typeof tokenOrError !== 'string') {
            return { ok: false, provider: this.provider, error: tokenOrError };
        }

        const submitBody = new URLSearchParams({
            api_type: 'json',
            kind: input.kind === 'text' ? 'self' : 'link',
            sr: subreddit,
            title: input.title,
        });

        if (input.kind === 'text') {
            submitBody.set('text', input.text);
        } else {
            submitBody.set('url', input.url);
        }

        const publishResponse = await fetch(
            `${REDDIT_OAUTH_BASE_URL}/api/submit`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${tokenOrError}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': config.userAgent,
                },
                body: submitBody,
                cache: 'no-store',
            },
        );

        if (!publishResponse.ok) {
            return {
                ok: false,
                provider: this.provider,
                error: {
                    code:
                        publishResponse.status >= 500
                            ? 'PROVIDER_UNAVAILABLE'
                            : 'REQUEST_REJECTED',
                    message: 'Reddit publish API request failed.',
                    retryable: publishResponse.status >= 500,
                },
            };
        }

        const payload = (await publishResponse.json()) as {
            json?: {
                data?: { id?: string; name?: string; url?: string };
                errors?: [string, string, string][];
            };
        };

        const firstError = payload.json?.errors?.[0]?.[0];
        if (firstError) {
            return {
                ok: false,
                provider: this.provider,
                error: mapRedditError(firstError),
            };
        }

        const data = payload.json?.data;
        if (!data?.id || !data?.url) {
            return {
                ok: false,
                provider: this.provider,
                error: {
                    code: 'UNKNOWN',
                    message: 'Reddit did not return published post metadata.',
                    retryable: false,
                },
            };
        }

        return {
            ok: true,
            provider: this.provider,
            post: {
                providerPostId: data.id,
                providerSubmissionId: data.name,
                permalink: data.url.startsWith('http')
                    ? data.url
                    : `https://www.reddit.com${data.url}`,
            },
        };
    }
}
