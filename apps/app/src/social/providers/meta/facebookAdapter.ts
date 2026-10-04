import 'server-only';

import { readSocialProviderRuntimeConfig } from '../config';
import { type FetchLike, invalidRequest, providerDisabled } from '../http';
import type {
    SocialPostInput,
    SocialProviderAdapter,
    SocialPublishError,
    SocialPublishResult,
} from '../types';
import {
    getMetaCreatedId,
    getMetaPermalink,
    normalizeMetaPublishResult,
    postMetaForm,
    readMetaProviderCredentials,
} from './metaGraph';

export class FacebookProviderAdapter implements SocialProviderAdapter {
    readonly name = 'facebook' as const;
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
        const credentials = readMetaProviderCredentials({
            provider: this.name,
            providerAccountKey: input.providerAccountKey,
            destination: input.destination,
        });
        if (isSocialPublishError(credentials)) return credentials;

        const baseUrl = `https://graph.facebook.com/${credentials.graphVersion}`;
        if (input.postType === 'image' || input.postType === 'carousel') {
            return await this.publishImagePost(input, credentials, baseUrl);
        }
        if (
            input.postType === 'video' ||
            input.postType === 'reel' ||
            input.postType === 'story'
        ) {
            return await this.publishVideoPost(input, credentials, baseUrl);
        }

        return await this.publishFeedPost(input, credentials, baseUrl);
    }

    private async publishFeedPost(
        input: SocialPostInput,
        credentials: {
            accessToken: string;
            destination: string;
            graphVersion: string;
        },
        baseUrl: string,
    ): Promise<SocialPublishResult> {
        const message = input.body || input.title;
        if (!message && !input.url) {
            return invalidRequest(
                'Facebook text and link posts require body text or a URL.',
            );
        }

        const params = new URLSearchParams({
            access_token: credentials.accessToken,
        });
        if (message) params.set('message', message);
        if (input.url) params.set('link', input.url);

        const payload = await postMetaForm({
            provider: this.name,
            fetchImpl: this.fetchImpl,
            url: `${baseUrl}/${credentials.destination}/feed`,
            params,
        });
        if (isSocialPublishError(payload)) return payload;

        const providerPostId = getMetaCreatedId(payload);
        const permalink = providerPostId
            ? await getMetaPermalink({
                  provider: this.name,
                  fetchImpl: this.fetchImpl,
                  baseUrl,
                  objectId: providerPostId,
                  accessToken: credentials.accessToken,
                  field: 'permalink_url',
              })
            : '';

        return normalizeMetaPublishResult({
            provider: this.name,
            providerPostId,
            permalink,
            metadata: {
                destination: credentials.destination,
                graphVersion: credentials.graphVersion,
            },
        });
    }

    private async publishImagePost(
        input: SocialPostInput,
        credentials: {
            accessToken: string;
            destination: string;
            graphVersion: string;
        },
        baseUrl: string,
    ): Promise<SocialPublishResult> {
        const mediaUrls = input.mediaUrls ?? [];
        if (!mediaUrls.length) {
            return invalidRequest(
                'Facebook image publishing requires at least one image URL.',
            );
        }
        if (mediaUrls.some((media) => media.type === 'video')) {
            return invalidRequest(
                'Facebook image publishing cannot include video media.',
            );
        }

        if (mediaUrls.length > 1 || input.postType === 'carousel') {
            return await this.publishMultiImagePost(
                input,
                credentials,
                baseUrl,
            );
        }

        const params = new URLSearchParams({
            access_token: credentials.accessToken,
            url: mediaUrls[0]?.url ?? '',
        });
        const caption = input.body || input.title;
        if (caption) params.set('caption', caption);

        const payload = await postMetaForm({
            provider: this.name,
            fetchImpl: this.fetchImpl,
            url: `${baseUrl}/${credentials.destination}/photos`,
            params,
        });
        if (isSocialPublishError(payload)) return payload;

        const providerPostId = getMetaCreatedId(payload);
        const permalink = providerPostId
            ? await getMetaPermalink({
                  provider: this.name,
                  fetchImpl: this.fetchImpl,
                  baseUrl,
                  objectId: providerPostId,
                  accessToken: credentials.accessToken,
                  field: 'permalink_url',
              })
            : '';

        return normalizeMetaPublishResult({
            provider: this.name,
            providerPostId,
            permalink,
            metadata: {
                destination: credentials.destination,
                graphVersion: credentials.graphVersion,
            },
        });
    }

    private async publishMultiImagePost(
        input: SocialPostInput,
        credentials: {
            accessToken: string;
            destination: string;
            graphVersion: string;
        },
        baseUrl: string,
    ): Promise<SocialPublishResult> {
        const attachedMediaIds: string[] = [];
        for (const media of input.mediaUrls ?? []) {
            const uploadPayload = await postMetaForm({
                provider: this.name,
                fetchImpl: this.fetchImpl,
                url: `${baseUrl}/${credentials.destination}/photos`,
                params: new URLSearchParams({
                    access_token: credentials.accessToken,
                    published: 'false',
                    url: media.url,
                }),
            });
            if (isSocialPublishError(uploadPayload)) return uploadPayload;

            const mediaId = getMetaCreatedId(uploadPayload);
            if (!mediaId) {
                return {
                    ok: false,
                    code: 'provider_unavailable',
                    message:
                        'Facebook unpublished photo upload returned no id.',
                    retriable: true,
                };
            }
            attachedMediaIds.push(mediaId);
        }

        const params = new URLSearchParams({
            access_token: credentials.accessToken,
        });
        const message = input.body || input.title;
        if (message) params.set('message', message);
        attachedMediaIds.forEach((mediaId, index) => {
            params.set(
                `attached_media[${index}]`,
                JSON.stringify({ media_fbid: mediaId }),
            );
        });

        const payload = await postMetaForm({
            provider: this.name,
            fetchImpl: this.fetchImpl,
            url: `${baseUrl}/${credentials.destination}/feed`,
            params,
        });
        if (isSocialPublishError(payload)) return payload;

        const providerPostId = getMetaCreatedId(payload);
        const permalink = providerPostId
            ? await getMetaPermalink({
                  provider: this.name,
                  fetchImpl: this.fetchImpl,
                  baseUrl,
                  objectId: providerPostId,
                  accessToken: credentials.accessToken,
                  field: 'permalink_url',
              })
            : '';

        return normalizeMetaPublishResult({
            provider: this.name,
            providerPostId,
            permalink,
            metadata: {
                destination: credentials.destination,
                graphVersion: credentials.graphVersion,
                attachedMediaIds,
            },
        });
    }

    private async publishVideoPost(
        input: SocialPostInput,
        credentials: {
            accessToken: string;
            destination: string;
            graphVersion: string;
        },
        baseUrl: string,
    ): Promise<SocialPublishResult> {
        const media = input.mediaUrls?.find((entry) => entry.type === 'video');
        if (!media) {
            return invalidRequest(
                'Facebook video publishing requires one video URL.',
            );
        }

        const params = new URLSearchParams({
            access_token: credentials.accessToken,
            file_url: media.url,
        });
        const description = input.body || input.title;
        if (description) params.set('description', description);

        const payload = await postMetaForm({
            provider: this.name,
            fetchImpl: this.fetchImpl,
            url: `${baseUrl}/${credentials.destination}/videos`,
            params,
        });
        if (isSocialPublishError(payload)) return payload;

        const providerPostId = getMetaCreatedId(payload);
        const permalink = providerPostId
            ? await getMetaPermalink({
                  provider: this.name,
                  fetchImpl: this.fetchImpl,
                  baseUrl,
                  objectId: providerPostId,
                  accessToken: credentials.accessToken,
                  field: 'permalink_url',
              })
            : '';

        return normalizeMetaPublishResult({
            provider: this.name,
            providerPostId,
            permalink,
            metadata: {
                destination: credentials.destination,
                graphVersion: credentials.graphVersion,
                submittedAs:
                    input.postType === 'reel' || input.postType === 'story'
                        ? 'page_video'
                        : 'video',
            },
        });
    }
}

function isSocialPublishError(value: unknown): value is SocialPublishError {
    return Boolean(value && typeof value === 'object' && 'ok' in value);
}
