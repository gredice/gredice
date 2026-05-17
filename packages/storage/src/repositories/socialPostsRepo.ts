import 'server-only';

import { and, asc, desc, eq, lte, or } from 'drizzle-orm';
import { storage } from '..';
import {
    type SelectSocialPost,
    type SocialPostStatus,
    type SocialPostType,
    type SocialProvider,
    socialPosts,
} from '../schema';

type JsonObject = Record<string, unknown>;

export type SocialPostMediaUrl = {
    url: string;
    type?: 'image' | 'video';
    alt?: string | null;
};

export type CreateSocialPostInput = {
    provider: SocialProvider;
    providerAccountKey: string;
    destination: string;
    status?: SocialPostStatus;
    postType: SocialPostType;
    title?: string | null;
    body?: string | null;
    url?: string | null;
    mediaUrls?: SocialPostMediaUrl[] | null;
    scheduledAt?: Date | null;
    queuedAt?: Date | null;
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
    scheduledAt?: Date | null;
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
            status: input.status,
            postType: input.postType,
            title: input.title ?? null,
            body: input.body ?? null,
            url: input.url ?? null,
            mediaUrls: input.mediaUrls ?? null,
            scheduledAt: input.scheduledAt ?? null,
            queuedAt:
                input.queuedAt ??
                (input.status === 'queued' ? new Date() : null),
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
            scheduledAt: input.scheduledAt,
            queuedAt: input.status === 'queued' ? now : undefined,
            submittedAt:
                input.status === 'submitted' || input.status === 'published'
                    ? now
                    : undefined,
            publishedAt: input.status === 'published' ? now : undefined,
            canceledAt: input.status === 'canceled' ? now : undefined,
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

export async function listReadySocialPosts({
    now = new Date(),
    limit = 20,
}: {
    now?: Date;
    limit?: number;
} = {}): Promise<SelectSocialPost[]> {
    return storage()
        .select()
        .from(socialPosts)
        .where(
            or(
                eq(socialPosts.status, 'queued'),
                and(
                    eq(socialPosts.status, 'scheduled'),
                    lte(socialPosts.scheduledAt, now),
                ),
            ),
        )
        .orderBy(asc(socialPosts.scheduledAt), asc(socialPosts.queuedAt))
        .limit(limit);
}
