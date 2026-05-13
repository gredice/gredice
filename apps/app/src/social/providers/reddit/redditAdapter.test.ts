import { expect, test } from '@playwright/test';

import { RedditProviderAdapter, readRedditEnv } from './redditAdapter';

function response(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
    });
}

async function captureWarnings<T>(
    callback: () => Promise<T>,
): Promise<{ result: T; warnings: unknown[][] }> {
    const originalWarn = console.warn;
    const warnings: unknown[][] = [];
    console.warn = (...args: unknown[]) => {
        warnings.push(args);
    };
    try {
        return { result: await callback(), warnings };
    } finally {
        console.warn = originalWarn;
    }
}

test('readRedditEnv builds allowlist and default destination', () => {
    const env = readRedditEnv({
        SOCIAL_PROVIDER_REDDIT_ENABLED: 'true',
        SOCIAL_PROVIDER_REDDIT_CLIENT_ID: 'id',
        SOCIAL_PROVIDER_REDDIT_CLIENT_SECRET: 'secret',
        SOCIAL_PROVIDER_REDDIT_USER_AGENT: 'ua',
        SOCIAL_PROVIDER_REDDIT_DEFAULT_DESTINATION: 'gredice',
        SOCIAL_PROVIDER_REDDIT_ALLOWED_DESTINATIONS: 'gardening, gredice',
    });

    expect(env.enabled).toBe(true);
    expect(env.allowedDestinations.has('gredice')).toBe(true);
    expect(env.allowedDestinations.has('gardening')).toBe(true);
});

test('publishPost returns operational error when missing credentials', async () => {
    const adapter = new RedditProviderAdapter(
        {
            enabled: true,
            clientId: '',
            clientSecret: '',
            userAgent: '',
            defaultDestination: '',
            allowedDestinations: new Set(),
        },
        async () => response({}),
    );

    const result = await adapter.publishPost({ title: 'Hello' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('missing_credentials');
});

test('publishPost submits text post and normalizes success', async () => {
    const calls: string[] = [];
    const adapter = new RedditProviderAdapter(
        {
            enabled: true,
            clientId: 'id',
            clientSecret: 'secret',
            userAgent: 'ua',
            defaultDestination: 'gredice',
            allowedDestinations: new Set(['gredice']),
        },
        async (url) => {
            calls.push(url.toString());
            if (url.toString().includes('access_token')) {
                return response({ access_token: 'token' });
            }
            return response({
                json: {
                    data: {
                        id: 'abc123',
                        name: 't3_abc123',
                        url: '/r/gredice/comments/abc123/test',
                    },
                    errors: [],
                },
            });
        },
    );

    const result = await adapter.publishPost({ title: 'Hi', body: 'body' });
    expect(result.ok).toBe(true);
    if (result.ok) {
        expect(result.providerPostId).toBe('abc123');
        expect(result.permalink).toBe(
            'https://reddit.com/r/gredice/comments/abc123/test',
        );
    }
    expect(calls).toHaveLength(2);
});

test('publishPost maps subreddit failure into sanitized invalid_destination', async () => {
    const adapter = new RedditProviderAdapter(
        {
            enabled: true,
            clientId: 'id',
            clientSecret: 'secret',
            userAgent: 'ua',
            defaultDestination: 'gredice',
            allowedDestinations: new Set(['gredice']),
        },
        async (url) => {
            if (url.toString().includes('access_token')) {
                return response({ access_token: 'token' });
            }
            return response(
                { json: { errors: [['SUBREDDIT_NOEXIST', 'invalid', 'sr']] } },
                400,
            );
        },
    );

    const result = await adapter.publishPost({ title: 'Hi' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
        expect(result.code).toBe('invalid_destination');
        expect(result.message.includes('credentials')).toBe(false);
    }
});

test('publishPost maps submit transport failures into retriable provider_unavailable', async () => {
    const adapter = new RedditProviderAdapter(
        {
            enabled: true,
            clientId: 'id',
            clientSecret: 'secret',
            userAgent: 'ua',
            defaultDestination: 'gredice',
            allowedDestinations: new Set(['gredice']),
        },
        async (url) => {
            if (url.toString().includes('access_token')) {
                return response({ access_token: 'token' });
            }
            throw new Error('network failed');
        },
    );

    const { result, warnings } = await captureWarnings(() =>
        adapter.publishPost({ title: 'Hi' }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
        expect(result.code).toBe('provider_unavailable');
        expect(result.retriable).toBe(true);
    }
    expect(warnings).toHaveLength(1);
});

test('publishPost maps non-JSON submit responses into retriable provider_unavailable', async () => {
    const adapter = new RedditProviderAdapter(
        {
            enabled: true,
            clientId: 'id',
            clientSecret: 'secret',
            userAgent: 'ua',
            defaultDestination: 'gredice',
            allowedDestinations: new Set(['gredice']),
        },
        async (url) => {
            if (url.toString().includes('access_token')) {
                return response({ access_token: 'token' });
            }
            return new Response('not json', { status: 502 });
        },
    );

    const { result, warnings } = await captureWarnings(() =>
        adapter.publishPost({ title: 'Hi' }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
        expect(result.code).toBe('provider_unavailable');
        expect(result.retriable).toBe(true);
    }
    expect(warnings).toHaveLength(1);
});
