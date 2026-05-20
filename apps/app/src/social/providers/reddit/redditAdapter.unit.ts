import assert from 'node:assert/strict';
import test from 'node:test';

import { RedditProviderAdapter, readRedditEnv } from './redditAdapter.ts';

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
        SOCIAL_PROVIDER_REDDIT_ACCESS_TOKEN: '',
        SOCIAL_PROVIDER_REDDIT_CLIENT_ID: 'id',
        SOCIAL_PROVIDER_REDDIT_CLIENT_SECRET: 'secret',
        SOCIAL_PROVIDER_REDDIT_REFRESH_TOKEN: 'refresh',
        SOCIAL_PROVIDER_REDDIT_USER_AGENT: 'ua',
        SOCIAL_PROVIDER_REDDIT_DEFAULT_DESTINATION: 'gredice',
        SOCIAL_PROVIDER_REDDIT_ALLOWED_DESTINATIONS: 'gardening, gredice',
    });

    assert.equal(env.enabled, true);
    assert.equal(env.allowedDestinations.has('gredice'), true);
    assert.equal(env.allowedDestinations.has('gardening'), true);
});

test('publishPost returns operational error when missing credentials', async () => {
    const adapter = new RedditProviderAdapter(
        {
            enabled: true,
            accessToken: '',
            clientId: '',
            clientSecret: '',
            refreshToken: '',
            userAgent: '',
            defaultDestination: '',
            allowedDestinations: new Set(),
        },
        async () => response({}),
    );

    const result = await adapter.publishPost({
        providerAccountKey: 'default',
        postType: 'text',
        title: 'Hello',
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'missing_credentials');
});

test('publishPost submits text post and normalizes success', async () => {
    const calls: string[] = [];
    const adapter = new RedditProviderAdapter(
        {
            enabled: true,
            accessToken: '',
            clientId: 'id',
            clientSecret: 'secret',
            refreshToken: 'refresh',
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

    const result = await adapter.publishPost({
        providerAccountKey: 'default',
        postType: 'text',
        title: 'Hi',
        body: 'body',
    });
    assert.equal(result.ok, true);
    if (result.ok) {
        assert.equal(result.providerPostId, 'abc123');
        assert.equal(
            result.permalink,
            'https://reddit.com/r/gredice/comments/abc123/test',
        );
    }
    assert.equal(calls.length, 2);
});

test('publishPost maps subreddit failure into sanitized invalid_destination', async () => {
    const adapter = new RedditProviderAdapter(
        {
            enabled: true,
            accessToken: '',
            clientId: 'id',
            clientSecret: 'secret',
            refreshToken: 'refresh',
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

    const result = await adapter.publishPost({
        providerAccountKey: 'default',
        postType: 'text',
        title: 'Hi',
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
        assert.equal(result.code, 'invalid_destination');
        assert.equal(result.message.includes('credentials'), false);
    }
});

test('publishPost maps submit transport failures into retriable provider_unavailable', async () => {
    const adapter = new RedditProviderAdapter(
        {
            enabled: true,
            accessToken: '',
            clientId: 'id',
            clientSecret: 'secret',
            refreshToken: 'refresh',
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
        adapter.publishPost({
            providerAccountKey: 'default',
            postType: 'text',
            title: 'Hi',
        }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
        assert.equal(result.code, 'provider_unavailable');
        assert.equal(result.retriable, true);
    }
    assert.equal(warnings.length, 1);
});

test('publishPost maps non-JSON submit responses into retriable provider_unavailable', async () => {
    const adapter = new RedditProviderAdapter(
        {
            enabled: true,
            accessToken: '',
            clientId: 'id',
            clientSecret: 'secret',
            refreshToken: 'refresh',
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
        adapter.publishPost({
            providerAccountKey: 'default',
            postType: 'text',
            title: 'Hi',
        }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
        assert.equal(result.code, 'provider_unavailable');
        assert.equal(result.retriable, true);
    }
    assert.equal(warnings.length, 1);
});

test('publishPost rejects unsupported media formats before transport', async () => {
    const adapter = new RedditProviderAdapter(
        {
            enabled: true,
            accessToken: 'token',
            clientId: 'id',
            clientSecret: 'secret',
            refreshToken: '',
            userAgent: 'ua',
            defaultDestination: 'gredice',
            allowedDestinations: new Set(['gredice']),
        },
        async () => response({ access_token: 'token' }),
    );

    const result = await adapter.publishPost({
        providerAccountKey: 'default',
        postType: 'story',
        title: 'Hi',
        mediaUrls: [{ url: 'https://gredice.com/story.jpg', type: 'image' }],
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'invalid_request');
});
