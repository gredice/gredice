import 'server-only';

import { and, desc, eq } from 'drizzle-orm';
import { storage } from '..';
import {
    type SelectSocialPost,
    type SocialPostProvider,
    type SocialPostStatus,
    type SocialPostType,
    socialPosts,
} from '../schema';

export type CreateSocialPostInput = {
    provider: SocialPostProvider;
    subreddit: string;
    postType: SocialPostType;
    title: string;
    bodyText?: string | null;
    url?: string | null;
    status?: SocialPostStatus;
};

export type UpdateSocialPostInput = {
    id: number;
    status?: SocialPostStatus;
    redditSubmissionId?: string | null;
    redditPermalink?: string | null;
    failureReason?: string | null;
    failureCode?: string | null;
    failureContext?: string | null;
};

export async function createSocialPost(
    input: CreateSocialPostInput,
): Promise<SelectSocialPost> {
    const [created] = await storage()
        .insert(socialPosts)
        .values({
            provider: input.provider,
            subreddit: input.subreddit,
            postType: input.postType,
            title: input.title,
            bodyText: input.bodyText ?? null,
            url: input.url ?? null,
            status: input.status ?? 'draft',
        })
        .returning();

    if (!created) {
        throw new Error('Failed to create social post');
    }

    return created;
}

export async function updateSocialPost(
    input: UpdateSocialPostInput,
): Promise<SelectSocialPost | null> {
    const [updated] = await storage()
        .update(socialPosts)
        .set({
            status: input.status,
            redditSubmissionId: input.redditSubmissionId,
            redditPermalink: input.redditPermalink,
            failureReason: input.failureReason,
            failureCode: input.failureCode,
            failureContext: input.failureContext,
            updatedAt: new Date(),
        })
        .where(eq(socialPosts.id, input.id))
        .returning();

    return updated ?? null;
}

export async function getSocialPostById(
    id: number,
): Promise<SelectSocialPost | null> {
    const [post] = await storage()
        .select()
        .from(socialPosts)
        .where(eq(socialPosts.id, id))
        .limit(1);

    return post ?? null;
}

export async function listSocialPosts(options?: {
    provider?: SocialPostProvider;
    status?: SocialPostStatus;
    limit?: number;
}): Promise<SelectSocialPost[]> {
    const conditions = [
        options?.provider
            ? eq(socialPosts.provider, options.provider)
            : undefined,
        options?.status ? eq(socialPosts.status, options.status) : undefined,
    ].filter((condition) => condition !== undefined);

    return storage()
        .select()
        .from(socialPosts)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(socialPosts.createdAt))
        .limit(options?.limit ?? 50);
}
