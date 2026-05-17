import assert from 'node:assert/strict';
import test from 'node:test';

import {
    createSocialProviderAdapter,
    FacebookProviderAdapter,
    GoogleBusinessProviderAdapter,
    InstagramProviderAdapter,
    LinkedInProviderAdapter,
    readSocialProviderEnv,
    socialProviderDefinitions,
    ThreadsProviderAdapter,
    TikTokProviderAdapter,
    WhatsAppProviderAdapter,
    XProviderAdapter,
} from './index.ts';

function jsonResponse(
    body: unknown,
    status = 200,
    headers?: Record<string, string>,
): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'content-type': 'application/json',
            ...headers,
        },
    });
}

async function withEnv<T>(
    env: Record<string, string>,
    callback: () => Promise<T> | T,
): Promise<T> {
    const oldValues = new Map<string, string | undefined>();
    for (const [key, value] of Object.entries(env)) {
        oldValues.set(key, process.env[key]);
        process.env[key] = value;
    }
    try {
        return await callback();
    } finally {
        for (const [key, value] of oldValues) {
            if (value === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = value;
            }
        }
    }
}

test('createSocialProviderAdapter returns a direct adapter for every provider', () => {
    for (const definition of socialProviderDefinitions) {
        const adapter = createSocialProviderAdapter(definition.name);
        assert.equal(adapter.constructor.name.startsWith('Generic'), false);
        assert.equal(adapter.name, definition.name);
    }
});

test('readSocialProviderEnv prefers account-specific direct credentials', () => {
    const accessToken = readSocialProviderEnv('instagram', 'ACCESS_TOKEN', {
        providerAccountKey: 'brand-main',
        env: {
            SOCIAL_PROVIDER_INSTAGRAM_ACCESS_TOKEN: 'fallback',
            SOCIAL_PROVIDER_INSTAGRAM_BRAND_MAIN_ACCESS_TOKEN: 'account-token',
        },
    });

    assert.equal(accessToken, 'account-token');
});

test('Instagram adapter creates and publishes a media container', async () => {
    await withEnv(
        {
            SOCIAL_PROVIDER_INSTAGRAM_ENABLED: 'true',
            SOCIAL_PROVIDER_INSTAGRAM_ACCESS_TOKEN: 'ig-token',
            SOCIAL_PROVIDER_INSTAGRAM_DEFAULT_DESTINATION: '17841400000000000',
            SOCIAL_PROVIDER_INSTAGRAM_ALLOWED_DESTINATIONS: '17841400000000000',
        },
        async () => {
            const calls: string[] = [];
            const adapter = new InstagramProviderAdapter(async (url) => {
                const requestUrl = url.toString();
                calls.push(requestUrl);
                if (requestUrl.includes('/media_publish')) {
                    return jsonResponse({ id: 'ig_media_1' });
                }
                if (requestUrl.includes('/ig_media_1')) {
                    return jsonResponse({
                        permalink: 'https://instagram.com/p/ig_media_1',
                    });
                }
                return jsonResponse({ id: 'ig_container_1' });
            });

            const result = await adapter.publishPost({
                providerAccountKey: 'default',
                postType: 'image',
                title: '',
                body: 'Caption',
                mediaUrls: [
                    {
                        url: 'https://gredice.com/photo.jpg',
                        type: 'image',
                    },
                ],
            });

            assert.equal(result.ok, true);
            if (result.ok) {
                assert.equal(result.providerPostId, 'ig_media_1');
            }
            assert.equal(calls.length, 3);
        },
    );
});

test('Facebook adapter publishes a direct Page feed post', async () => {
    await withEnv(
        {
            SOCIAL_PROVIDER_FACEBOOK_ENABLED: 'true',
            SOCIAL_PROVIDER_FACEBOOK_ACCESS_TOKEN: 'fb-token',
            SOCIAL_PROVIDER_FACEBOOK_DEFAULT_DESTINATION: '12345',
            SOCIAL_PROVIDER_FACEBOOK_ALLOWED_DESTINATIONS: '12345',
        },
        async () => {
            const adapter = new FacebookProviderAdapter(async (url) => {
                const requestUrl = url.toString();
                if (requestUrl.includes('/fb_post_1')) {
                    return jsonResponse({
                        permalink_url: 'https://facebook.com/fb_post_1',
                    });
                }
                return jsonResponse({ id: 'fb_post_1' });
            });

            const result = await adapter.publishPost({
                providerAccountKey: 'default',
                postType: 'text',
                title: '',
                body: 'Facebook update',
            });

            assert.equal(result.ok, true);
            if (result.ok) {
                assert.equal(result.providerPostId, 'fb_post_1');
            }
        },
    );
});

test('Google Business adapter creates a local post directly', async () => {
    await withEnv(
        {
            SOCIAL_PROVIDER_GOOGLE_BUSINESS_ENABLED: 'true',
            SOCIAL_PROVIDER_GOOGLE_BUSINESS_ACCESS_TOKEN: 'google-token',
            SOCIAL_PROVIDER_GOOGLE_BUSINESS_DEFAULT_DESTINATION:
                'accounts/1/locations/2',
            SOCIAL_PROVIDER_GOOGLE_BUSINESS_ALLOWED_DESTINATIONS:
                'accounts/1/locations/2',
        },
        async () => {
            const adapter = new GoogleBusinessProviderAdapter(async () =>
                jsonResponse({
                    name: 'accounts/1/locations/2/localPosts/3',
                    searchUrl: 'https://business.google.com/post/3',
                }),
            );

            const result = await adapter.publishPost({
                providerAccountKey: 'default',
                postType: 'link',
                title: '',
                body: 'Business update',
                url: 'https://gredice.com',
            });

            assert.equal(result.ok, true);
            if (result.ok) {
                assert.equal(
                    result.providerPostId,
                    'accounts/1/locations/2/localPosts/3',
                );
            }
        },
    );
});

test('X adapter uploads media and creates a post', async () => {
    await withEnv(
        {
            SOCIAL_PROVIDER_X_ENABLED: 'true',
            SOCIAL_PROVIDER_X_ACCESS_TOKEN: 'x-token',
            SOCIAL_PROVIDER_X_DEFAULT_DESTINATION: '@gredice',
            SOCIAL_PROVIDER_X_ALLOWED_DESTINATIONS: '@gredice',
        },
        async () => {
            const calls: string[] = [];
            const adapter = new XProviderAdapter(async (url) => {
                const requestUrl = url.toString();
                calls.push(requestUrl);
                if (requestUrl === 'https://gredice.com/photo.png') {
                    return new Response(new Uint8Array(Buffer.from('image')), {
                        headers: { 'content-type': 'image/png' },
                    });
                }
                if (requestUrl.includes('/media/upload/initialize')) {
                    return jsonResponse({ data: { id: 'media_1' } });
                }
                if (requestUrl.includes('/append')) {
                    return jsonResponse({ data: { expires_at: 1 } });
                }
                if (requestUrl.includes('/finalize')) {
                    return jsonResponse({
                        data: {
                            id: 'media_1',
                            processing_info: { state: 'succeeded' },
                        },
                    });
                }
                return jsonResponse({ data: { id: 'tweet_1' } }, 201);
            });

            const result = await adapter.publishPost({
                providerAccountKey: 'default',
                postType: 'image',
                title: '',
                body: 'X update',
                destination: '@gredice',
                mediaUrls: [
                    {
                        url: 'https://gredice.com/photo.png',
                        type: 'image',
                    },
                ],
            });

            assert.equal(result.ok, true);
            assert.ok(calls.some((call) => call.includes('/2/tweets')));
        },
    );
});

test('TikTok adapter initializes a direct video post', async () => {
    await withEnv(
        {
            SOCIAL_PROVIDER_TIKTOK_ENABLED: 'true',
            SOCIAL_PROVIDER_TIKTOK_ACCESS_TOKEN: 'tt-token',
            SOCIAL_PROVIDER_TIKTOK_DEFAULT_DESTINATION: '@gredice',
            SOCIAL_PROVIDER_TIKTOK_ALLOWED_DESTINATIONS: '@gredice',
            SOCIAL_PROVIDER_TIKTOK_PRIVACY_LEVEL: 'SELF_ONLY',
        },
        async () => {
            const adapter = new TikTokProviderAdapter(async (url) => {
                const requestUrl = url.toString();
                if (requestUrl.includes('/creator_info/query')) {
                    return jsonResponse({
                        data: {
                            creator_username: 'gredice',
                            privacy_level_options: ['SELF_ONLY'],
                        },
                        error: { code: 'ok' },
                    });
                }
                return jsonResponse({
                    data: { publish_id: 'v_pub_1' },
                    error: { code: 'ok' },
                });
            });

            const result = await adapter.publishPost({
                providerAccountKey: 'default',
                postType: 'reel',
                title: '',
                body: 'TikTok caption',
                mediaUrls: [
                    {
                        url: 'https://gredice.com/video.mp4',
                        type: 'video',
                    },
                ],
            });

            assert.equal(result.ok, true);
            if (result.ok) assert.equal(result.providerPostId, 'v_pub_1');
        },
    );
});

test('Threads adapter creates and publishes a text container', async () => {
    await withEnv(
        {
            SOCIAL_PROVIDER_THREADS_ENABLED: 'true',
            SOCIAL_PROVIDER_THREADS_ACCESS_TOKEN: 'threads-token',
            SOCIAL_PROVIDER_THREADS_DEFAULT_DESTINATION: 'me',
            SOCIAL_PROVIDER_THREADS_ALLOWED_DESTINATIONS: 'me',
        },
        async () => {
            const adapter = new ThreadsProviderAdapter(async (url) => {
                const requestUrl = url.toString();
                if (requestUrl.includes('/threads_publish')) {
                    return jsonResponse({ id: 'thread_1' });
                }
                if (requestUrl.includes('/thread_1')) {
                    return jsonResponse({
                        permalink: 'https://threads.net/@gredice/post/thread_1',
                    });
                }
                return jsonResponse({ id: 'thread_container_1' });
            });

            const result = await adapter.publishPost({
                providerAccountKey: 'default',
                postType: 'text',
                title: '',
                body: 'Threads update',
            });

            assert.equal(result.ok, true);
            if (result.ok) assert.equal(result.providerPostId, 'thread_1');
        },
    );
});

test('LinkedIn adapter creates an organic text post', async () => {
    await withEnv(
        {
            SOCIAL_PROVIDER_LINKEDIN_ENABLED: 'true',
            SOCIAL_PROVIDER_LINKEDIN_ACCESS_TOKEN: 'li-token',
            SOCIAL_PROVIDER_LINKEDIN_DEFAULT_DESTINATION:
                'urn:li:organization:123',
            SOCIAL_PROVIDER_LINKEDIN_ALLOWED_DESTINATIONS:
                'urn:li:organization:123',
        },
        async () => {
            const adapter = new LinkedInProviderAdapter(async () =>
                jsonResponse({}, 201, {
                    'x-restli-id': 'urn:li:share:123',
                }),
            );

            const result = await adapter.publishPost({
                providerAccountKey: 'default',
                postType: 'text',
                title: '',
                body: 'LinkedIn update',
            });

            assert.equal(result.ok, true);
            if (result.ok) {
                assert.equal(result.providerPostId, 'urn:li:share:123');
            }
        },
    );
});

test('WhatsApp adapter sends a Cloud API message directly', async () => {
    await withEnv(
        {
            SOCIAL_PROVIDER_WHATSAPP_ENABLED: 'true',
            SOCIAL_PROVIDER_WHATSAPP_ACCESS_TOKEN: 'wa-token',
            SOCIAL_PROVIDER_WHATSAPP_PHONE_NUMBER_ID: '12345',
            SOCIAL_PROVIDER_WHATSAPP_DEFAULT_DESTINATION: '385911234567',
            SOCIAL_PROVIDER_WHATSAPP_ALLOWED_DESTINATIONS: '385911234567',
        },
        async () => {
            const adapter = new WhatsAppProviderAdapter(async () =>
                jsonResponse({ messages: [{ id: 'wamid.1' }] }),
            );

            const result = await adapter.publishPost({
                providerAccountKey: 'default',
                postType: 'text',
                title: '',
                body: 'WhatsApp update',
            });

            assert.equal(result.ok, true);
            if (result.ok) assert.equal(result.providerPostId, 'wamid.1');
        },
    );
});
