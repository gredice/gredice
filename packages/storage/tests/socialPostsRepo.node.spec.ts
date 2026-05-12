import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createSocialPost,
    getSocialPostById,
    listSocialPosts,
    updateSocialPost,
} from '@gredice/storage';
import { sql } from 'drizzle-orm';
import { createTestDb } from './testDb';

async function ensureSocialPostsTable() {
    const db = createTestDb();
    await db.execute(sql`
        DO $$ BEGIN
            CREATE TYPE social_post_provider AS ENUM ('reddit');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `);
    await db.execute(sql`
        DO $$ BEGIN
            CREATE TYPE social_post_type AS ENUM ('text', 'link');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `);
    await db.execute(sql`
        DO $$ BEGIN
            CREATE TYPE social_post_status AS ENUM ('draft', 'submitting', 'published', 'failed');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `);
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS social_posts (
            id serial PRIMARY KEY,
            provider social_post_provider NOT NULL DEFAULT 'reddit',
            subreddit text NOT NULL,
            post_type social_post_type NOT NULL,
            title text NOT NULL,
            body_text text,
            url text,
            status social_post_status NOT NULL DEFAULT 'draft',
            reddit_submission_id text,
            reddit_permalink text,
            failure_reason text,
            failure_code text,
            failure_context text,
            created_at timestamp NOT NULL DEFAULT now(),
            updated_at timestamp NOT NULL DEFAULT now()
        );
    `);
}

test('socialPostsRepo supports create and detail retrieval', async () => {
    await ensureSocialPostsTable();

    const created = await createSocialPost({
        provider: 'reddit',
        subreddit: 'gardening',
        postType: 'text',
        title: 'Fresh garden update',
        bodyText: 'Season kickoff post',
    });

    assert.equal(created.provider, 'reddit');
    assert.equal(created.status, 'draft');

    const found = await getSocialPostById(created.id);
    assert.ok(found);
    assert.equal(found.title, 'Fresh garden update');
});

test('socialPostsRepo supports status lifecycle and successful publish update', async () => {
    await ensureSocialPostsTable();

    const created = await createSocialPost({
        provider: 'reddit',
        subreddit: 'croatia',
        postType: 'link',
        title: 'Planting tips',
        url: 'https://example.com/tips',
    });

    const submitting = await updateSocialPost({
        id: created.id,
        status: 'submitting',
    });
    assert.ok(submitting);
    assert.equal(submitting.status, 'submitting');

    const published = await updateSocialPost({
        id: created.id,
        status: 'published',
        redditSubmissionId: 't3_abc123',
        redditPermalink: '/r/croatia/comments/abc123/planting_tips/',
        failureReason: null,
        failureCode: null,
        failureContext: null,
    });

    assert.ok(published);
    assert.equal(published.status, 'published');
    assert.equal(published.redditSubmissionId, 't3_abc123');
});

test('socialPostsRepo preserves failure context and supports list filtering', async () => {
    await ensureSocialPostsTable();

    const failed = await createSocialPost({
        provider: 'reddit',
        subreddit: 'homestead',
        postType: 'text',
        title: 'Failed attempt post',
        bodyText: 'Will fail',
        status: 'submitting',
    });

    await updateSocialPost({
        id: failed.id,
        status: 'failed',
        failureReason: 'Subreddit requires flair',
        failureCode: 'reddit_rule_violation',
        failureContext: '{"httpStatus":403,"requestId":"req_123"}',
    });

    const list = await listSocialPosts({
        provider: 'reddit',
        status: 'failed',
        limit: 10,
    });

    assert.ok(list.some((post) => post.id === failed.id));
    const failedPost = list.find((post) => post.id === failed.id);
    assert.ok(failedPost);
    assert.equal(failedPost.failureCode, 'reddit_rule_violation');
    assert.equal(await updateSocialPost({ id: -1, status: 'failed' }), null);
});
