import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createSocialPost,
    getSocialPostById,
    listSocialPosts,
    updateSocialPostStatus,
} from '@gredice/storage';
import { createTestDb } from './testDb';

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
