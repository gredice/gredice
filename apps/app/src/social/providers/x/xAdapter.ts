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

const X_API_BASE_URL = 'https://api.x.com/2';
const MEDIA_UPLOAD_CHUNK_SIZE = 4 * 1024 * 1024;

export class XProviderAdapter implements SocialProviderAdapter {
    readonly name = 'x' as const;
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
                message: 'X access token is missing.',
                retriable: false,
            };
        }

        const text = [input.body || input.title, input.url]
            .filter(Boolean)
            .join(' ');
        if (!text && !input.mediaUrls?.length) {
            return invalidRequest('X posts require text, URL, or media.');
        }

        const mediaIds: string[] = [];
        for (const mediaUrl of input.mediaUrls ?? []) {
            const downloaded = await downloadMedia(mediaUrl, this.fetchImpl);
            if (!isDownloadedMedia(downloaded)) return downloaded;

            const mediaId = await this.uploadMedia(downloaded, accessToken);
            if (isSocialPublishError(mediaId)) return mediaId;
            mediaIds.push(mediaId);
        }

        const body: Record<string, unknown> = {};
        if (text) body.text = text;
        if (mediaIds.length) body.media = { media_ids: mediaIds };

        let response: Response;
        try {
            response = await this.fetchImpl(`${X_API_BASE_URL}/tweets`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });
        } catch (error) {
            return {
                ok: false,
                code: 'provider_unavailable',
                message: 'X post request failed.',
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

        const providerPostId = getNestedString(payload, 'data', 'id');
        if (!providerPostId) {
            return {
                ok: false,
                code: 'provider_unavailable',
                message: 'X post response returned no id.',
                retriable: true,
            };
        }

        const handle = destination.destination.replace(/^@/, '');
        return {
            ok: true,
            providerPostId,
            permalink: handle
                ? `https://x.com/${handle}/status/${providerPostId}`
                : `https://x.com/i/web/status/${providerPostId}`,
            metadata: {
                destination: destination.destination,
                mediaIds,
            },
        };
    }

    private async uploadMedia(
        media: DownloadedMedia,
        accessToken: string,
    ): Promise<string | SocialPublishError> {
        const mediaCategory =
            media.source.type === 'video' ? 'tweet_video' : 'tweet_image';
        const initPayload = await this.postJson(
            `${X_API_BASE_URL}/media/upload/initialize`,
            {
                media_category: mediaCategory,
                media_type: media.contentType,
                total_bytes: media.size,
            },
            accessToken,
        );
        if (isSocialPublishError(initPayload)) return initPayload;

        const mediaId = getNestedString(initPayload, 'data', 'id');
        if (!mediaId) {
            return {
                ok: false,
                code: 'provider_unavailable',
                message: 'X media upload initialization returned no id.',
                retriable: true,
            };
        }

        for (
            let offset = 0, segmentIndex = 0;
            offset < media.bytes.byteLength;
            offset += MEDIA_UPLOAD_CHUNK_SIZE, segmentIndex++
        ) {
            const chunk = media.bytes.subarray(
                offset,
                offset + MEDIA_UPLOAD_CHUNK_SIZE,
            );
            const appendPayload = await this.postJson(
                `${X_API_BASE_URL}/media/upload/${mediaId}/append`,
                {
                    media: chunk.toString('base64'),
                    segment_index: segmentIndex,
                },
                accessToken,
            );
            if (isSocialPublishError(appendPayload)) return appendPayload;
        }

        const finalizePayload = await this.postJson(
            `${X_API_BASE_URL}/media/upload/${mediaId}/finalize`,
            {},
            accessToken,
        );
        if (isSocialPublishError(finalizePayload)) return finalizePayload;

        const processingInfo = getRecord(
            getRecord(finalizePayload, 'data'),
            'processing_info',
        );
        const processingState = getString(processingInfo, 'state');
        if (processingState && processingState !== 'succeeded') {
            const statusResult = await this.waitForMediaProcessing(
                mediaId,
                accessToken,
                processingInfo,
            );
            if (statusResult) return statusResult;
        }

        return mediaId;
    }

    private async waitForMediaProcessing(
        mediaId: string,
        accessToken: string,
        initialProcessingInfo: Record<string, unknown> | null,
    ): Promise<SocialPublishError | null> {
        let processingInfo = initialProcessingInfo;
        for (let attempt = 0; attempt < 6; attempt++) {
            const state = getString(processingInfo, 'state');
            if (state === 'succeeded') return null;
            if (state === 'failed') {
                return {
                    ok: false,
                    code: 'invalid_request',
                    message: 'X media processing failed.',
                    retriable: false,
                };
            }

            const checkAfterSeconds =
                getNumber(processingInfo, 'check_after_secs') ?? 1;
            await new Promise((resolve) =>
                setTimeout(resolve, Math.min(checkAfterSeconds, 5) * 1000),
            );

            const statusUrl = new URL(`${X_API_BASE_URL}/media/upload`);
            statusUrl.searchParams.set('media_id', mediaId);
            statusUrl.searchParams.set('command', 'STATUS');
            const statusPayload = await this.getJson(
                statusUrl.toString(),
                accessToken,
            );
            if (isSocialPublishError(statusPayload)) return statusPayload;
            processingInfo = getRecord(
                getRecord(statusPayload, 'data'),
                'processing_info',
            );
        }

        return {
            ok: false,
            code: 'provider_unavailable',
            message: 'X media processing did not finish in time.',
            retriable: true,
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
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });
        } catch (error) {
            return {
                ok: false,
                code: 'provider_unavailable',
                message: 'X media upload request failed.',
                retriable: true,
                details: {
                    errorType:
                        error instanceof Error ? error.name : typeof error,
                },
            } satisfies SocialPublishError;
        }

        const payload = await readJsonResponse(response);
        if (!response.ok) {
            return mapHttpProviderError(this.name, response.status, payload);
        }

        return payload;
    }

    private async getJson(url: string, accessToken: string) {
        let response: Response;
        try {
            response = await this.fetchImpl(url, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });
        } catch (error) {
            return {
                ok: false,
                code: 'provider_unavailable',
                message: 'X media status request failed.',
                retriable: true,
                details: {
                    errorType:
                        error instanceof Error ? error.name : typeof error,
                },
            } satisfies SocialPublishError;
        }

        const payload = await readJsonResponse(response);
        if (!response.ok) {
            return mapHttpProviderError(this.name, response.status, payload);
        }

        return payload;
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
