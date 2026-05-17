import 'server-only';

import {
    readSocialProviderEnv,
    readSocialProviderRuntimeConfig,
    resolveConfiguredDestination,
} from '../config';
import {
    type DownloadedMedia,
    downloadMedia,
    type FetchLike,
    getArray,
    getNestedString,
    getNumber,
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

const LINKEDIN_API_BASE_URL = 'https://api.linkedin.com/rest';

export class LinkedInProviderAdapter implements SocialProviderAdapter {
    readonly name = 'linkedin' as const;
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

        const accessToken = readSocialProviderEnv(this.name, 'ACCESS_TOKEN', {
            providerAccountKey: input.providerAccountKey,
        });
        if (!accessToken) {
            return {
                ok: false,
                code: 'missing_credentials',
                message: 'LinkedIn access token is missing.',
                retriable: false,
            };
        }

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
        if (!/^urn:li:(organization|person):/.test(destination.destination)) {
            return {
                ok: false,
                code: 'invalid_destination',
                message:
                    'LinkedIn destination must be an organization or person URN.',
                retriable: false,
            };
        }

        const linkedInVersion =
            readSocialProviderEnv(this.name, 'API_VERSION', {
                providerAccountKey: input.providerAccountKey,
            }) || '202605';
        const mediaUrn = await this.uploadPostMedia(
            input,
            destination.destination,
            accessToken,
            linkedInVersion,
        );
        if (isSocialPublishError(mediaUrn)) return mediaUrn;

        const postPayload = this.createPostPayload(
            input,
            destination.destination,
            mediaUrn,
        );
        if (isSocialPublishError(postPayload)) return postPayload;
        const postResult = await this.postLinkedInJson(
            `${LINKEDIN_API_BASE_URL}/posts`,
            postPayload,
            accessToken,
            linkedInVersion,
            'POST',
        );
        if (isSocialPublishError(postResult)) return postResult;

        if (!postResult.restliId) {
            return {
                ok: false,
                code: 'provider_unavailable',
                message: 'LinkedIn post response returned no post id.',
                retriable: true,
            };
        }

        return {
            ok: true,
            providerPostId: postResult.restliId,
            permalink: `https://www.linkedin.com/feed/update/${encodeURIComponent(
                postResult.restliId,
            )}`,
            metadata: {
                destination: destination.destination,
                linkedInVersion,
                mediaUrn,
            },
        };
    }

    private createPostPayload(
        input: SocialPostInput,
        author: string,
        mediaUrn: string | null,
    ): Record<string, unknown> | SocialPublishError {
        const commentary = [input.body || input.title, input.url]
            .filter(Boolean)
            .join('\n');
        const payload: Record<string, unknown> = {
            author,
            commentary,
            visibility: 'PUBLIC',
            distribution: {
                feedDistribution: 'MAIN_FEED',
                targetEntities: [],
                thirdPartyDistributionChannels: [],
            },
            lifecycleState: 'PUBLISHED',
            isReshareDisabledByAuthor: false,
        };

        if (mediaUrn) {
            payload.content = {
                media: {
                    title: input.title || 'Gredice',
                    id: mediaUrn,
                },
            };
        } else if (!commentary) {
            return invalidRequest(
                'LinkedIn posts require text, URL, or media.',
            );
        }

        return payload;
    }

    private async uploadPostMedia(
        input: SocialPostInput,
        owner: string,
        accessToken: string,
        linkedInVersion: string,
    ): Promise<string | null | SocialPublishError> {
        const media = input.mediaUrls?.[0];
        if (!media) return null;
        if ((input.mediaUrls?.length ?? 0) > 1) {
            return invalidRequest(
                'LinkedIn direct publishing currently accepts one media item per post.',
            );
        }

        const downloaded = await downloadMedia(media, this.fetchImpl);
        if (!isDownloadedMedia(downloaded)) return downloaded;

        return media.type === 'video'
            ? await this.uploadVideo(
                  downloaded,
                  owner,
                  accessToken,
                  linkedInVersion,
              )
            : await this.uploadImage(
                  downloaded,
                  owner,
                  accessToken,
                  linkedInVersion,
              );
    }

    private async uploadImage(
        media: DownloadedMedia,
        owner: string,
        accessToken: string,
        linkedInVersion: string,
    ): Promise<string | SocialPublishError> {
        const initPayload = await this.postLinkedInJson(
            `${LINKEDIN_API_BASE_URL}/images?action=initializeUpload`,
            {
                initializeUploadRequest: {
                    owner,
                },
            },
            accessToken,
            linkedInVersion,
            'POST',
        );
        if (isSocialPublishError(initPayload)) return initPayload;

        const uploadUrl = getNestedString(
            initPayload.payload,
            'value',
            'uploadUrl',
        );
        const imageUrn = getNestedString(initPayload.payload, 'value', 'image');
        if (!uploadUrl || !imageUrn) {
            return {
                ok: false,
                code: 'provider_unavailable',
                message:
                    'LinkedIn image upload initialization returned no URL.',
                retriable: true,
            };
        }

        const uploadResult = await this.putLinkedInUpload(
            uploadUrl,
            media.bytes,
            media.contentType,
        );
        if (isSocialPublishError(uploadResult)) return uploadResult;

        return imageUrn;
    }

    private async uploadVideo(
        media: DownloadedMedia,
        owner: string,
        accessToken: string,
        linkedInVersion: string,
    ): Promise<string | SocialPublishError> {
        const initPayload = await this.postLinkedInJson(
            `${LINKEDIN_API_BASE_URL}/videos?action=initializeUpload`,
            {
                initializeUploadRequest: {
                    owner,
                    fileSizeBytes: media.size,
                    uploadCaptions: false,
                    uploadThumbnail: false,
                },
            },
            accessToken,
            linkedInVersion,
            'POST',
        );
        if (isSocialPublishError(initPayload)) return initPayload;

        const value = getRecord(initPayload.payload, 'value');
        const videoUrn = getString(value, 'video');
        const uploadToken = getString(value, 'uploadToken') ?? '';
        const uploadInstructions = getArray(value, 'uploadInstructions');
        if (!videoUrn || uploadInstructions.length === 0) {
            return {
                ok: false,
                code: 'provider_unavailable',
                message:
                    'LinkedIn video upload initialization returned no URL.',
                retriable: true,
            };
        }

        const uploadedPartIds: string[] = [];
        for (const instruction of uploadInstructions) {
            const uploadUrl = getString(instruction, 'uploadUrl');
            const firstByte = getNumber(instruction, 'firstByte');
            const lastByte = getNumber(instruction, 'lastByte');
            if (
                !uploadUrl ||
                firstByte === undefined ||
                lastByte === undefined
            ) {
                return {
                    ok: false,
                    code: 'provider_unavailable',
                    message: 'LinkedIn video upload instruction is incomplete.',
                    retriable: true,
                };
            }

            const uploadResponse = await this.putLinkedInUpload(
                uploadUrl,
                media.bytes.subarray(firstByte, lastByte + 1),
                media.contentType,
            );
            if (isSocialPublishError(uploadResponse)) return uploadResponse;
            if (!uploadResponse.etag) {
                return {
                    ok: false,
                    code: 'provider_unavailable',
                    message: 'LinkedIn video upload returned no part id.',
                    retriable: true,
                };
            }
            uploadedPartIds.push(uploadResponse.etag);
        }

        const finalizePayload = await this.postLinkedInJson(
            `${LINKEDIN_API_BASE_URL}/videos?action=finalizeUpload`,
            {
                finalizeUploadRequest: {
                    video: videoUrn,
                    uploadToken,
                    uploadedPartIds,
                },
            },
            accessToken,
            linkedInVersion,
            'POST',
        );
        if (isSocialPublishError(finalizePayload)) return finalizePayload;

        return videoUrn;
    }

    private async postLinkedInJson(
        url: string,
        body: Record<string, unknown>,
        accessToken: string,
        linkedInVersion: string,
        method: 'POST',
    ): Promise<
        { payload: unknown; restliId: string | null } | SocialPublishError
    > {
        let response: Response;
        try {
            response = await this.fetchImpl(url, {
                method,
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'Linkedin-Version': linkedInVersion,
                    'X-Restli-Protocol-Version': '2.0.0',
                },
                body: JSON.stringify(body),
            });
        } catch (error) {
            return {
                ok: false,
                code: 'provider_unavailable',
                message: 'LinkedIn API request failed.',
                retriable: true,
                details: {
                    errorType:
                        error instanceof Error ? error.name : typeof error,
                },
            };
        }

        const payload = await readJsonResponse(response);
        if (!response.ok) {
            return mapHttpProviderError(this.name, response.status, payload);
        }

        return {
            payload,
            restliId: response.headers.get('x-restli-id'),
        };
    }

    private async putLinkedInUpload(
        uploadUrl: string,
        bytes: Buffer,
        contentType: string,
    ): Promise<{ etag: string } | SocialPublishError> {
        let response: Response;
        try {
            response = await this.fetchImpl(uploadUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': contentType || 'application/octet-stream',
                },
                body: new Uint8Array(bytes),
            });
        } catch (error) {
            return {
                ok: false,
                code: 'provider_unavailable',
                message: 'LinkedIn media upload failed.',
                retriable: true,
                details: {
                    errorType:
                        error instanceof Error ? error.name : typeof error,
                },
            };
        }

        if (!response.ok) {
            const payload = await readJsonResponse(response);
            return mapHttpProviderError(this.name, response.status, payload);
        }

        return {
            etag: (response.headers.get('etag') ?? '').replaceAll('"', ''),
        };
    }
}

function isDownloadedMedia(value: unknown): value is DownloadedMedia {
    return Boolean(
        value &&
            typeof value === 'object' &&
            'bytes' in value &&
            'base64' in value,
    );
}

function isSocialPublishError(value: unknown): value is SocialPublishError {
    return Boolean(value && typeof value === 'object' && 'ok' in value);
}
