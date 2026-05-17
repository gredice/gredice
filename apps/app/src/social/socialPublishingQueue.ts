import 'server-only';

import {
    getSetting,
    isSocialPublishingSettingValue,
    listReadySocialPosts,
    type SelectSocialPost,
    SettingsKeys,
    type SocialPostMediaUrl,
    type SocialPostStatus,
    updateSocialPostStatus,
} from '@gredice/storage';
import { createSocialProviderAdapter } from './providers';

export type SubmitSocialPostResult = {
    ok: boolean;
    errorCode?: 'provider_error' | 'internal_error';
    message: string;
    socialPostId: number;
    status: SocialPostStatus;
    providerPermalink?: string | null;
};

export type ProcessReadySocialPostsResult = {
    processed: number;
    failed: number;
};

export async function processReadySocialPosts({
    limit,
}: {
    limit: number;
}): Promise<ProcessReadySocialPostsResult> {
    const readyPosts = await listReadySocialPosts({ limit });
    let failed = 0;
    for (const post of readyPosts) {
        const result = await submitSocialPost(post);
        if (!result.ok) failed += 1;
    }

    return {
        processed: readyPosts.length,
        failed,
    };
}

export async function submitSocialPost(
    post: SelectSocialPost,
): Promise<SubmitSocialPostResult> {
    try {
        await updateSocialPostStatus({
            id: post.id,
            status: 'submitting',
        });

        const adapter = createSocialProviderAdapter(
            post.provider,
            await getProviderConfig(post.provider),
        );
        const configError = adapter.validateConfig();
        if (configError) {
            await updateSocialPostStatus({
                id: post.id,
                status: 'failed',
                failureCode: configError.code,
                failureMessage: configError.message,
                failureMetadata: sanitizeProviderErrorDetails(
                    configError.details,
                ),
            });
            return {
                ok: false,
                errorCode: 'provider_error',
                message: configError.message,
                socialPostId: post.id,
                status: 'failed',
            };
        }

        const providerResult = await adapter.publishPost({
            providerAccountKey: post.providerAccountKey,
            postType: post.postType,
            title: post.title ?? '',
            body: post.body ?? undefined,
            url: post.url ?? undefined,
            destination: post.destination,
            mediaUrls: normalizeStoredMediaUrls(post.mediaUrls),
        });

        if (!providerResult.ok) {
            await updateSocialPostStatus({
                id: post.id,
                status: 'failed',
                failureCode: providerResult.code,
                failureMessage: providerResult.message,
                failureMetadata: sanitizeProviderErrorDetails(
                    providerResult.details,
                ),
            });

            return {
                ok: false,
                errorCode: 'provider_error',
                message: providerResult.message,
                socialPostId: post.id,
                status: 'failed',
            };
        }

        const finalStatus = providerResult.permalink
            ? 'published'
            : 'submitted';
        await updateSocialPostStatus({
            id: post.id,
            status: finalStatus,
            providerSubmissionId: providerResult.providerPostId,
            providerPermalink: providerResult.permalink || null,
            providerMetadata: providerResult.metadata ?? null,
        });

        return {
            ok: true,
            message: 'Objava je uspješno poslana.',
            socialPostId: post.id,
            status: finalStatus,
            providerPermalink: providerResult.permalink || null,
        };
    } catch (error) {
        await updateSocialPostStatus({
            id: post.id,
            status: 'failed',
            failureCode: 'unexpected_publish_error',
            failureMessage: 'Neočekivana greška tijekom slanja objave.',
            failureMetadata: sanitizeUnexpectedErrorDetails(error),
        });

        return {
            ok: false,
            errorCode: 'internal_error',
            message: 'Objava nije uspješno poslana zbog neočekivane greške.',
            socialPostId: post.id,
            status: 'failed',
        };
    }
}

async function getProviderConfig(provider: SelectSocialPost['provider']) {
    const setting = await getSetting(SettingsKeys.SocialPublishing);
    if (!isSocialPublishingSettingValue(setting?.value)) {
        return undefined;
    }

    return setting.value.providers[provider];
}

export function sanitizeProviderErrorDetails(
    details: Record<string, unknown> | undefined,
): Record<string, unknown> | null {
    if (!details) return null;
    const safeKeys = new Set(['status', 'providerErrorId', 'reason']);
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(details)) {
        if (safeKeys.has(key) && value !== undefined) {
            sanitized[key] = value;
        }
    }
    return Object.keys(sanitized).length ? sanitized : null;
}

function sanitizeUnexpectedErrorDetails(
    error: unknown,
): Record<string, unknown> {
    return {
        errorType: error instanceof Error ? error.name : typeof error,
    };
}

function normalizeStoredMediaUrls(value: unknown): SocialPostMediaUrl[] {
    if (!Array.isArray(value)) return [];
    const mediaUrls: SocialPostMediaUrl[] = [];
    for (const item of value) {
        if (!isRecord(item)) continue;
        const url = item.url;
        const type = item.type;
        if (typeof url !== 'string' || !isHttpUrl(url)) continue;
        mediaUrls.push({
            url,
            type: type === 'video' || type === 'image' ? type : undefined,
        });
    }
    return mediaUrls;
}

function isHttpUrl(value: string): boolean {
    try {
        const parsed = new URL(value);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
