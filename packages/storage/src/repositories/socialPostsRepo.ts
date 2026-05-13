import 'server-only';

import { and, desc, eq } from 'drizzle-orm';
import { storage } from '..';
import {
    type SelectSocialPost,
    type SocialPostStatus,
    type SocialPostType,
    type SocialProvider,
    socialPosts,
} from '../schema';

type JsonObject = Record<string, unknown>;

export type CreateSocialPostInput = {
    provider: SocialProvider;
    providerAccountKey: string;
    destination: string;
    postType: SocialPostType;
    title?: string | null;
    body?: string | null;
    url?: string | null;
    providerMetadata?: JsonObject | null;
};

export type UpdateSocialPostStatusInput = {
    id: number;
    status: SocialPostStatus;
    providerSubmissionId?: string | null;
    providerPermalink?: string | null;
    providerMetadata?: JsonObject | null;
    failureCode?: string | null;
    failureMessage?: string | null;
    failureMetadata?: JsonObject | null;
};

export async function createSocialPost(
    input: CreateSocialPostInput,
): Promise<SelectSocialPost> {
    const [created] = await storage()
        .insert(socialPosts)
        .values({
            provider: input.provider,
            providerAccountKey: input.providerAccountKey,
            destination: input.destination,
            postType: input.postType,
            title: input.title ?? null,
            body: input.body ?? null,
            url: input.url ?? null,
            providerMetadata: input.providerMetadata ?? null,
        })
        .returning();

    if (!created) {
        throw new Error('Failed to create social post');
    }

    return created;
}

export async function updateSocialPostStatus(
    input: UpdateSocialPostStatusInput,
): Promise<SelectSocialPost | null> {
    const now = new Date();

    const [updated] = await storage()
        .update(socialPosts)
        .set({
            status: input.status,
            providerSubmissionId: input.providerSubmissionId,
            providerPermalink: input.providerPermalink,
            providerMetadata: input.providerMetadata,
            failureCode: input.failureCode,
            failureMessage: input.failureMessage,
            failureMetadata: input.failureMetadata,
            submittedAt:
                input.status === 'submitted' || input.status === 'published'
                    ? now
                    : undefined,
            publishedAt: input.status === 'published' ? now : undefined,
            updatedAt: now,
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

export async function listSocialPosts(filters?: {
    provider?: SocialProvider;
    status?: SocialPostStatus;
}): Promise<SelectSocialPost[]> {
    const whereClause = and(
        filters?.provider
            ? eq(socialPosts.provider, filters.provider)
            : undefined,
        filters?.status ? eq(socialPosts.status, filters.status) : undefined,
    );

    return storage()
        .select()
        .from(socialPosts)
        .where(whereClause)
        .orderBy(desc(socialPosts.createdAt));
}
