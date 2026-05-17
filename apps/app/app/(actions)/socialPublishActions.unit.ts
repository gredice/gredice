import assert from 'node:assert/strict';
import test from 'node:test';
import { socialProviderDefinitions } from '../../src/social/providers/definitions.ts';
import { __testUtils } from './socialPublishActions.ts';

const objectiveProviderRequirements = [
    { provider: 'reddit', postTypes: ['text', 'link'] },
    { provider: 'instagram', postTypes: ['image', 'video', 'reel', 'story'] },
    {
        provider: 'facebook',
        postTypes: ['text', 'link', 'image', 'video', 'reel', 'story'],
    },
    { provider: 'google_business', postTypes: ['text', 'link', 'image'] },
    { provider: 'x', postTypes: ['text', 'link', 'image', 'video'] },
    { provider: 'tiktok', postTypes: ['video', 'reel'] },
    { provider: 'threads', postTypes: ['text', 'link', 'image', 'video'] },
    { provider: 'linkedin', postTypes: ['text', 'link', 'image', 'video'] },
    { provider: 'whatsapp', postTypes: ['story', 'image', 'video'] },
] as const;

const providerValidationCases = [
    {
        provider: 'reddit',
        destination: 'r/gardening',
        postType: 'text',
        title: 'Title',
        body: 'Body',
    },
    {
        provider: 'instagram',
        destination: '@gredice',
        postType: 'story',
        body: 'Story caption',
        mediaUrls: 'https://gredice.com/story.jpg',
    },
    {
        provider: 'facebook',
        destination: 'Gredice',
        postType: 'story',
        body: 'Story caption',
        mediaUrls: 'https://gredice.com/story.jpg',
    },
    {
        provider: 'google_business',
        destination: 'Gredice Zagreb',
        postType: 'image',
        body: 'Business update',
        mediaUrls: 'https://gredice.com/location.jpg',
    },
    {
        provider: 'x',
        destination: '@gredice',
        postType: 'video',
        body: 'Video update',
        mediaUrls: 'https://gredice.com/video.mp4',
    },
    {
        provider: 'tiktok',
        destination: '@gredice',
        postType: 'reel',
        body: 'Reel caption',
        mediaUrls: 'https://gredice.com/reel.mp4',
    },
    {
        provider: 'threads',
        destination: '@gredice',
        postType: 'image',
        body: 'Image update',
        mediaUrls: 'https://gredice.com/thread.jpg',
    },
    {
        provider: 'linkedin',
        destination: 'Gredice',
        postType: 'video',
        body: 'Company video',
        mediaUrls: 'https://gredice.com/linkedin-video.mp4',
    },
    {
        provider: 'whatsapp',
        destination: 'Gredice',
        postType: 'story',
        body: 'Status story',
        mediaUrls: 'https://gredice.com/status.mp4',
    },
] as const;

test('validatePayload rejects missing required fields', () => {
    const payload = __testUtils.normalizePayload(new FormData());
    const result = __testUtils.validatePayload(payload);
    assert.equal(result.ok, false);
    if (!result.ok) {
        assert.equal(result.state.errorCode, 'invalid_payload');
    }
});

test('validatePayload accepts valid text publish payload', () => {
    const formData = new FormData();
    formData.set('provider', 'reddit');
    formData.set('providerAccountKey', 'default');
    formData.set('destination', 'r/gardening');
    formData.set('postType', 'text');
    formData.set('title', 'Title');
    formData.set('body', 'Body');
    formData.set('submissionToken', 'submission-token-123');
    formData.set('intent', 'publish');

    const payload = __testUtils.normalizePayload(formData);
    const result = __testUtils.validatePayload(payload);
    assert.equal(result.ok, true);
    if (result.ok) {
        assert.equal(result.payload.destination, 'gardening');
    }
});

test('provider definitions cover every requested social network and post type', () => {
    for (const requirement of objectiveProviderRequirements) {
        const definition = socialProviderDefinitions.find(
            (providerDefinition) =>
                providerDefinition.name === requirement.provider,
        );
        assert.ok(definition, `Missing ${requirement.provider} provider`);
        for (const postType of requirement.postTypes) {
            assert.ok(
                definition.supportedPostTypes.some(
                    (supportedPostType) => supportedPostType === postType,
                ),
                `${requirement.provider} missing ${postType} support`,
            );
        }
    }
});

test('validatePayload accepts representative payloads for every requested provider', () => {
    for (const validationCase of providerValidationCases) {
        const formData = new FormData();
        formData.set('provider', validationCase.provider);
        formData.set('providerAccountKey', 'default');
        formData.set('destination', validationCase.destination);
        formData.set('postType', validationCase.postType);
        formData.set(
            'title',
            'title' in validationCase ? validationCase.title : '',
        );
        formData.set(
            'body',
            'body' in validationCase ? validationCase.body : '',
        );
        formData.set(
            'mediaUrls',
            'mediaUrls' in validationCase ? validationCase.mediaUrls : '',
        );
        formData.set('url', '');
        formData.set(
            'submissionToken',
            `submission-token-${validationCase.provider}`,
        );
        formData.set('intent', 'queue');

        const payload = __testUtils.normalizePayload(formData);
        const result = __testUtils.validatePayload(payload);
        assert.equal(result.ok, true, validationCase.provider);
    }
});

test('validatePayload accepts queued Instagram story with media', () => {
    const formData = new FormData();
    formData.set('provider', 'instagram');
    formData.set('providerAccountKey', 'default');
    formData.set('destination', '@gredice');
    formData.set('postType', 'story');
    formData.set('body', 'Story caption');
    formData.set('mediaUrls', 'https://gredice.com/story.jpg');
    formData.set('submissionToken', 'submission-token-456');
    formData.set('intent', 'queue');

    const payload = __testUtils.normalizePayload(formData);
    const result = __testUtils.validatePayload(payload);
    assert.equal(result.ok, true);
    if (result.ok) {
        assert.equal(result.payload.provider, 'instagram');
        assert.equal(result.payload.postType, 'story');
        assert.equal(result.payload.mediaUrls[0]?.type, 'image');
    }
});

test('validatePayload rejects unsupported provider post type pair', () => {
    const formData = new FormData();
    formData.set('provider', 'reddit');
    formData.set('providerAccountKey', 'default');
    formData.set('destination', 'r/gardening');
    formData.set('postType', 'story');
    formData.set('title', 'Title');
    formData.set('mediaUrls', 'https://gredice.com/story.jpg');
    formData.set('submissionToken', 'submission-token-789');
    formData.set('intent', 'queue');

    const payload = __testUtils.normalizePayload(formData);
    const result = __testUtils.validatePayload(payload);
    assert.equal(result.ok, false);
    if (!result.ok) {
        assert.equal(result.state.errorCode, 'invalid_payload');
    }
});

test('validatePayload rejects video and reel posts without video media', () => {
    for (const postType of ['video', 'reel']) {
        const formData = new FormData();
        formData.set('provider', postType === 'reel' ? 'tiktok' : 'x');
        formData.set('providerAccountKey', 'default');
        formData.set('destination', '@gredice');
        formData.set('postType', postType);
        formData.set('body', 'Caption');
        formData.set('mediaUrls', 'https://gredice.com/photo.jpg');
        formData.set('submissionToken', `submission-token-${postType}`);
        formData.set('intent', 'queue');

        const payload = __testUtils.normalizePayload(formData);
        const result = __testUtils.validatePayload(payload);
        assert.equal(result.ok, false, postType);
        if (!result.ok) {
            assert.equal(result.state.errorCode, 'invalid_payload');
        }
    }
});

test('validatePayload requires multiple media items for carousel posts', () => {
    const formData = new FormData();
    formData.set('provider', 'instagram');
    formData.set('providerAccountKey', 'default');
    formData.set('destination', '@gredice');
    formData.set('postType', 'carousel');
    formData.set('body', 'Carousel caption');
    formData.set('mediaUrls', 'https://gredice.com/photo.jpg');
    formData.set('submissionToken', 'submission-token-carousel');
    formData.set('intent', 'queue');

    const payload = __testUtils.normalizePayload(formData);
    const result = __testUtils.validatePayload(payload);
    assert.equal(result.ok, false);

    formData.set(
        'mediaUrls',
        'https://gredice.com/photo-1.jpg\nhttps://gredice.com/photo-2.jpg',
    );
    const validPayload = __testUtils.normalizePayload(formData);
    const validResult = __testUtils.validatePayload(validPayload);
    assert.equal(validResult.ok, true);
});

test('validatePayload requires future scheduled time for scheduled posts', () => {
    const formData = new FormData();
    formData.set('provider', 'linkedin');
    formData.set('providerAccountKey', 'default');
    formData.set('destination', 'Gredice');
    formData.set('postType', 'text');
    formData.set('body', 'Scheduled update');
    formData.set('scheduledAt', '2040-01-01T10:00');
    formData.set('submissionToken', 'submission-token-999');
    formData.set('intent', 'schedule');

    const payload = __testUtils.normalizePayload(formData);
    const result = __testUtils.validatePayload(
        payload,
        new Date('2039-01-01T00:00:00.000Z'),
    );
    assert.equal(result.ok, true);

    formData.set('scheduledAt', '2020-01-01T10:00');
    const pastPayload = __testUtils.normalizePayload(formData);
    const pastResult = __testUtils.validatePayload(
        pastPayload,
        new Date('2039-01-01T00:00:00.000Z'),
    );
    assert.equal(pastResult.ok, false);
});

test('sanitizeProviderErrorDetails strips sensitive fields', () => {
    const sanitized = __testUtils.sanitizeProviderErrorDetails({
        status: 403,
        reason: 'blocked',
        providerErrorId: 'x',
        accessToken: 'secret',
    });
    assert.deepEqual(sanitized, {
        status: 403,
        reason: 'blocked',
        providerErrorId: 'x',
    });
});
