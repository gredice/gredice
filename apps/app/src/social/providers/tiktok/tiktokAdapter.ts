import 'server-only';

import {
    readSocialProviderEnv,
    readSocialProviderRuntimeConfig,
    resolveConfiguredDestination,
} from '../config';
import {
    type FetchLike,
    getArray,
    getNestedString,
    getRecord,
    getString,
    invalidRequest,
    mapHttpProviderError,
    providerDisabled,
    readJsonResponse,
} from '../http';
import type {
    SocialPostInput,
    SocialProviderAdapter,
    SocialPublishError,
    SocialPublishResult,
} from '../types';

const TIKTOK_API_BASE_URL = 'https://open.tiktokapis.com/v2/post/publish';

export class TikTokProviderAdapter implements SocialProviderAdapter {
    readonly name = 'tiktok' as const;
    private readonly fetchImpl: FetchLike;

    constructor(fetchImpl: FetchLike = fetch) {
        this.fetchImpl = fetchImpl;
    }

    validateConfig(
        input?: Pick<SocialPostInput, 'providerAccountKey'>,
    ): SocialPublishError | null {
        return readSocialProviderRuntimeConfig(this.name, {
            providerAccountKey: input?.providerAccountKey,
        }).enabled
            ? null
            : providerDisabled(this.name);
    }

    async publishPost(input: SocialPostInput): Promise<SocialPublishResult> {
        const config = readSocialProviderRuntimeConfig(this.name, {
            providerAccountKey: input.providerAccountKey,
        });
        if (!config.enabled) return providerDisabled(this.name);

        const destination = resolveConfiguredDestination(
            this.name,
            input.destination,
            config,
        );
        if (!destination.ok) {
            return {
                ok: false,
                code: destination.code,
                message: destination.message,
                retriable: false,
            };
        }

        const accessToken = readSocialProviderEnv(this.name, 'ACCESS_TOKEN', {
            providerAccountKey: input.providerAccountKey,
        });
        if (!accessToken) {
            return {
                ok: false,
                code: 'missing_credentials',
                message: 'TikTok access token is missing.',
                retriable: false,
            };
        }

        const privacyLevel =
            readSocialProviderEnv(this.name, 'PRIVACY_LEVEL', {
                providerAccountKey: input.providerAccountKey,
            }) || 'SELF_ONLY';
        const creatorInfo = await this.queryCreatorInfo(accessToken);
        if (isSocialPublishError(creatorInfo)) return creatorInfo;
        if (
            creatorInfo.privacyLevelOptions.length > 0 &&
            !creatorInfo.privacyLevelOptions.includes(privacyLevel)
        ) {
            return invalidRequest(
                'TikTok privacy level is not available for this creator.',
                { reason: privacyLevel },
            );
        }

        const result =
            input.postType === 'image' || input.postType === 'carousel'
                ? await this.publishPhoto(
                      input,
                      accessToken,
                      privacyLevel,
                      input.providerAccountKey,
                  )
                : await this.publishVideo(
                      input,
                      accessToken,
                      privacyLevel,
                      input.providerAccountKey,
                  );
        if (!result.ok) return result;

        return {
            ...result,
            metadata: {
                ...(result.metadata ?? {}),
                destination: destination.destination,
                privacyLevel,
                creatorUsername: creatorInfo.username,
            },
        };
    }

    private async queryCreatorInfo(
        accessToken: string,
    ): Promise<
        { username: string; privacyLevelOptions: string[] } | SocialPublishError
    > {
        const payload = await this.postJson(
            `${TIKTOK_API_BASE_URL}/creator_info/query/`,
            {},
            accessToken,
        );
        if (isSocialPublishError(payload)) return payload;

        const data = getRecord(payload, 'data');
        return {
            username: getString(data, 'creator_username') ?? '',
            privacyLevelOptions: getArray(data, 'privacy_level_options').filter(
                (entry): entry is string => typeof entry === 'string',
            ),
        };
    }

    private async publishVideo(
        input: SocialPostInput,
        accessToken: string,
        privacyLevel: string,
        providerAccountKey: string,
    ): Promise<SocialPublishResult> {
        const video = input.mediaUrls?.find((media) => media.type === 'video');
        if (!video) {
            return invalidRequest(
                'TikTok video publishing requires a video URL.',
            );
        }

        const payload = await this.postJson(
            `${TIKTOK_API_BASE_URL}/video/init/`,
            {
                post_info: {
                    title: input.body || input.title || 'Gredice',
                    privacy_level: privacyLevel,
                    disable_duet:
                        readSocialProviderEnv(this.name, 'DISABLE_DUET', {
                            providerAccountKey,
                        }) === 'true',
                    disable_comment:
                        readSocialProviderEnv(this.name, 'DISABLE_COMMENT', {
                            providerAccountKey,
                        }) === 'true',
                    disable_stitch:
                        readSocialProviderEnv(this.name, 'DISABLE_STITCH', {
                            providerAccountKey,
                        }) === 'true',
                },
                source_info: {
                    source: 'PULL_FROM_URL',
                    video_url: video.url,
                },
            },
            accessToken,
        );
        if (isSocialPublishError(payload)) return payload;

        return this.publishIdResult(payload, 'video');
    }

    private async publishPhoto(
        input: SocialPostInput,
        accessToken: string,
        privacyLevel: string,
        providerAccountKey: string,
    ): Promise<SocialPublishResult> {
        const photoUrls = (input.mediaUrls ?? [])
            .filter((media) => media.type !== 'video')
            .map((media) => media.url);
        if (!photoUrls.length) {
            return invalidRequest(
                'TikTok photo publishing requires image URLs.',
            );
        }

        const payload = await this.postJson(
            `${TIKTOK_API_BASE_URL}/content/init/`,
            {
                post_info: {
                    title: input.title || 'Gredice',
                    description: input.body || input.url || '',
                    privacy_level: privacyLevel,
                    auto_add_music:
                        readSocialProviderEnv(this.name, 'AUTO_ADD_MUSIC', {
                            providerAccountKey,
                        }) === 'true',
                },
                source_info: {
                    source: 'PULL_FROM_URL',
                    photo_cover_index: 0,
                    photo_images: photoUrls,
                },
                post_mode: 'DIRECT_POST',
                media_type: 'PHOTO',
            },
            accessToken,
        );
        if (isSocialPublishError(payload)) return payload;

        return this.publishIdResult(payload, 'photo');
    }

    private publishIdResult(
        payload: unknown,
        mediaType: 'photo' | 'video',
    ): SocialPublishResult {
        const providerPostId =
            getNestedString(payload, 'data', 'publish_id') ??
            getString(payload, 'publish_id');
        if (!providerPostId) {
            return {
                ok: false,
                code: 'provider_unavailable',
                message: 'TikTok publish response returned no publish id.',
                retriable: true,
            };
        }

        return {
            ok: true,
            providerPostId,
            permalink: '',
            metadata: {
                mediaType,
            },
        };
    }

    private async postJson(
        url: string,
        body: Record<string, unknown>,
        accessToken: string,
    ) {
        let response: Response;
        try {
            response = await this.fetchImpl(url, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json; charset=UTF-8',
                },
                body: JSON.stringify(body),
            });
        } catch (error) {
            return {
                ok: false,
                code: 'provider_unavailable',
                message: 'TikTok publish request failed.',
                retriable: true,
                details: {
                    errorType:
                        error instanceof Error ? error.name : typeof error,
                },
            } satisfies SocialPublishError;
        }

        const payload = await readJsonResponse(response);
        const errorCode = getNestedString(payload, 'error', 'code');
        if (!response.ok || (errorCode && errorCode !== 'ok')) {
            return mapHttpProviderError(this.name, response.status, payload);
        }

        return payload;
    }
}

function isSocialPublishError(value: unknown): value is SocialPublishError {
    return Boolean(value && typeof value === 'object' && 'ok' in value);
}
