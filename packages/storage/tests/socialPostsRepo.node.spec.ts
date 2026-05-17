import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createSocialAccount,
    createSocialPost,
    getSocialAccountByProviderKey,
    getSocialPostById,
    listReadySocialPosts,
    listSocialAccounts,
    listSocialPosts,
    updateSocialAccount,
    updateSocialPostStatus,
} from '@gredice/storage';
import { createTestDb } from './testDb';

test('socialAccountsRepo creates, updates, and lists provider accounts', async () => {
    createTestDb();

    const account = await createSocialAccount({
        provider: 'instagram',
        providerAccountKey: 'brand-main',
        label: 'Gredice Instagram',
        handle: '@gredice',
        defaultDestination: '17841400000000000',
        allowedDestinations: ['17841400000000000'],
        credentialReference: 'SOCIAL_PROVIDER_INSTAGRAM_ACCESS_TOKEN',
    });

    assert.equal(account.provider, 'instagram');
    assert.equal(account.status, 'active');
    assert.ok(Array.isArray(account.allowedDestinations));

    const updated = await updateSocialAccount({
        id: account.id,
        status: 'needs_reauth',
        label: 'Gredice Instagram Main',
    });
    assert.equal(updated?.status, 'needs_reauth');
    assert.equal(updated?.label, 'Gredice Instagram Main');

    const loaded = await getSocialAccountByProviderKey({
        provider: 'instagram',
        providerAccountKey: 'brand-main',
    });
    assert.equal(loaded?.id, account.id);

    const needsReauth = await listSocialAccounts({
        status: 'needs_reauth',
    });
    assert.ok(needsReauth.some((entry) => entry.id === account.id));
});

test('socialPostsRepo create and detail read', async () => {
    createTestDb();

    const post = await createSocialPost({
        provider: 'reddit',
        providerAccountKey: 'oauth:account-1',
        destination: 'r/gredice',
        postType: 'text',
        title: 'Fresh basil update',
        body: 'New seedlings are ready.',
        providerMetadata: { subreddit: 'gredice' },
    });

    assert.equal(post.status, 'created');
    assert.equal(post.provider, 'reddit');

    const loaded = await getSocialPostById(post.id);
    assert.ok(loaded);
    assert.equal(loaded?.destination, 'r/gredice');
});

test('socialPostsRepo stores multi-provider media queue metadata', async () => {
    createTestDb();

    const queued = await createSocialPost({
        provider: 'instagram',
        providerAccountKey: 'brand-main',
        destination: '17841400000000000',
        status: 'queued',
        postType: 'story',
        body: 'Harvest story',
        mediaUrls: [
            {
                url: 'https://gredice.com/assets/story.jpg',
                type: 'image',
            },
        ],
        providerMetadata: { campaign: 'spring' },
    });

    assert.equal(queued.provider, 'instagram');
    assert.equal(queued.status, 'queued');
    assert.ok(queued.queuedAt);
    assert.ok(Array.isArray(queued.mediaUrls));
});

test('socialPostsRepo status transitions and provider response data', async () => {
    createTestDb();

    const post = await createSocialPost({
        provider: 'reddit',
        providerAccountKey: 'oauth:account-2',
        destination: 'r/gardening',
        postType: 'link',
        url: 'https://gredice.com/blog',
    });

    const submitting = await updateSocialPostStatus({
        id: post.id,
        status: 'submitting',
    });
    assert.equal(submitting?.status, 'submitting');

    const submitted = await updateSocialPostStatus({
        id: post.id,
        status: 'submitted',
        providerSubmissionId: 't3_abcd1234',
        providerPermalink: 'https://reddit.com/r/gardening/comments/abcd1234',
        providerMetadata: {
            subreddit: 'gardening',
            redditId: 'abcd1234',
            redditName: 't3_abcd1234',
        },
    });

    assert.equal(submitted?.status, 'submitted');
    assert.equal(submitted?.providerSubmissionId, 't3_abcd1234');
    assert.ok(submitted?.submittedAt);
});

test('socialPostsRepo list filters by provider and status', async () => {
    createTestDb();

    await createSocialPost({
        provider: 'reddit',
        providerAccountKey: 'oauth:account-3',
        destination: 'r/urbanfarming',
        postType: 'text',
        body: 'Compost tips',
    });

    const second = await createSocialPost({
        provider: 'reddit',
        providerAccountKey: 'oauth:account-4',
        destination: 'r/gardening',
        postType: 'text',
        body: 'Raised bed checklist',
    });

    await updateSocialPostStatus({
        id: second.id,
        status: 'failed',
        failureCode: 'RATE_LIMITED',
        failureMessage: 'Provider temporarily rejected this post.',
        failureMetadata: { retryable: true, httpStatus: 429 },
    });

    const redditPosts = await listSocialPosts({ provider: 'reddit' });
    assert.ok(redditPosts.length >= 2);

    const failedPosts = await listSocialPosts({
        provider: 'reddit',
        status: 'failed',
    });
    assert.ok(failedPosts.length >= 1);
    assert.equal(failedPosts[0]?.failureCode, 'RATE_LIMITED');
});

test('socialPostsRepo lists queued and due scheduled posts for processing', async () => {
    createTestDb();

    const dueDate = new Date('2040-01-01T08:00:00.000Z');
    const futureDate = new Date('2040-01-03T08:00:00.000Z');

    const queued = await createSocialPost({
        provider: 'facebook',
        providerAccountKey: 'brand-main',
        destination: '1234567890',
        status: 'queued',
        postType: 'text',
        body: 'Queued update',
    });
    const due = await createSocialPost({
        provider: 'linkedin',
        providerAccountKey: 'brand-main',
        destination: 'urn:li:organization:123456',
        status: 'scheduled',
        postType: 'text',
        body: 'Scheduled update',
        scheduledAt: dueDate,
    });
    const future = await createSocialPost({
        provider: 'threads',
        providerAccountKey: 'brand-main',
        destination: 'me',
        status: 'scheduled',
        postType: 'text',
        body: 'Future update',
        scheduledAt: futureDate,
    });

    const readyPosts = await listReadySocialPosts({
        now: new Date('2040-01-02T00:00:00.000Z'),
    });
    const readyIds = new Set(readyPosts.map((post) => post.id));

    assert.equal(readyIds.has(queued.id), true);
    assert.equal(readyIds.has(due.id), true);
    assert.equal(readyIds.has(future.id), false);
});

test('socialPostsRepo preserves sanitized failure context', async () => {
    createTestDb();

    const post = await createSocialPost({
        provider: 'reddit',
        providerAccountKey: 'oauth:account-5',
        destination: 'r/gredice',
        postType: 'text',
        body: 'Support-debug payload',
    });

    const failed = await updateSocialPostStatus({
        id: post.id,
        status: 'failed',
        failureCode: 'VALIDATION_FAILED',
        failureMessage: 'Title is required for this destination.',
        failureMetadata: {
            providerErrorId: 'err-123',
            field: 'title',
            retryable: false,
        },
    });

    assert.equal(failed?.status, 'failed');
    assert.equal(failed?.failureCode, 'VALIDATION_FAILED');
    assert.equal(
        failed?.failureMessage,
        'Title is required for this destination.',
    );
    assert.ok(failed?.failureMetadata);
});
