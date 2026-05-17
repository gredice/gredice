import assert from 'node:assert/strict';
import test from 'node:test';

import { GenericConfiguredProviderAdapter } from './genericConfiguredAdapter.ts';

function response(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
    });
}

test('validateConfig rejects disabled DB provider config', () => {
    const adapter = new GenericConfiguredProviderAdapter('instagram', {
        enabled: false,
        endpoint: '',
        apiKey: '',
        defaultDestination: '',
        allowedDestinations: new Set(),
    });

    const result = adapter.validateConfig();

    assert.equal(result?.code, 'provider_disabled');
});

test('publishPost posts normalized payload to configured bridge endpoint', async () => {
    let capturedBody: unknown;
    let capturedAuth: string | null = null;
    const adapter = new GenericConfiguredProviderAdapter(
        'instagram',
        {
            enabled: true,
            endpoint: 'https://social.example.com/instagram',
            apiKey: 'secret',
            defaultDestination: '@gredice',
            allowedDestinations: new Set(['@gredice']),
        },
        async (_url, init) => {
            capturedAuth = readAuthorization(init?.headers);
            capturedBody =
                typeof init?.body === 'string'
                    ? JSON.parse(init.body)
                    : undefined;
            return response({
                providerPostId: 'ig_123',
                permalink: 'https://instagram.com/p/ig_123',
                metadata: { mediaContainerId: 'container_123' },
            });
        },
    );

    const result = await adapter.publishPost({
        providerAccountKey: 'default',
        postType: 'story',
        title: '',
        body: 'Story caption',
        destination: '@gredice',
        mediaUrls: [{ url: 'https://gredice.com/story.jpg', type: 'image' }],
    });

    assert.equal(result.ok, true);
    if (result.ok) {
        assert.equal(result.providerPostId, 'ig_123');
        assert.equal(result.permalink, 'https://instagram.com/p/ig_123');
    }
    assert.equal(capturedAuth, 'Bearer secret');
    assert.deepEqual(capturedBody, {
        provider: 'instagram',
        providerAccountKey: 'default',
        destination: '@gredice',
        postType: 'story',
        title: '',
        body: 'Story caption',
        mediaUrls: [
            {
                url: 'https://gredice.com/story.jpg',
                type: 'image',
            },
        ],
    });
});

test('publishPost maps provider bridge rate limits', async () => {
    const adapter = new GenericConfiguredProviderAdapter(
        'tiktok',
        {
            enabled: true,
            endpoint: 'https://social.example.com/tiktok',
            apiKey: '',
            defaultDestination: '@gredice',
            allowedDestinations: new Set(['@gredice']),
        },
        async () =>
            response({ providerErrorId: 'rate-1', reason: 'try_later' }, 429),
    );

    const result = await adapter.publishPost({
        providerAccountKey: 'default',
        postType: 'reel',
        title: '',
        destination: '@gredice',
        mediaUrls: [{ url: 'https://gredice.com/video.mp4', type: 'video' }],
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
        assert.equal(result.code, 'rate_limited');
        assert.equal(result.retriable, true);
        assert.equal(result.details?.providerErrorId, 'rate-1');
    }
});

function readAuthorization(headers: HeadersInit | undefined): string | null {
    if (!headers) return null;
    if (headers instanceof Headers) return headers.get('authorization');
    if (Array.isArray(headers)) {
        return (
            headers.find(
                ([key]) => key.toLowerCase() === 'authorization',
            )?.[1] ?? null
        );
    }
    const value = headers.Authorization ?? headers.authorization;
    return typeof value === 'string' ? value : null;
}
