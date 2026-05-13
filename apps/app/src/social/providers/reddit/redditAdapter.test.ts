import assert from 'node:assert/strict';
import test from 'node:test';

import { RedditProviderAdapter, readRedditEnv } from './redditAdapter';

function response(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
    });
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

    assert.equal(env.enabled, true);
    assert.equal(env.allowedDestinations.has('gredice'), true);
    assert.equal(env.allowedDestinations.has('gardening'), true);
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
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'missing_credentials');
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
    assert.equal(result.ok, false);
    if (!result.ok) {
        assert.equal(result.code, 'invalid_destination');
        assert.equal(result.message.includes('credentials'), false);
    }
});
