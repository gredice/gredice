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

export class InstagramProviderAdapter implements SocialProviderAdapter {
    readonly name = 'instagram' as const;
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

        if (!input.mediaUrls?.length) {
            return invalidRequest(
                'Instagram publishing requires at least one image or video URL.',
            );
        }

        const baseUrl = `https://graph.facebook.com/${credentials.graphVersion}`;
        const container = await this.createContainer(
            input,
            credentials,
            baseUrl,
        );
        if (!container.ok) return container;

        const publishPayload = await postMetaForm({
            provider: this.name,
            fetchImpl: this.fetchImpl,
            url: `${baseUrl}/${credentials.destination}/media_publish`,
            params: new URLSearchParams({
                creation_id: container.containerId,
                access_token: credentials.accessToken,
            }),
        });
        if (isSocialPublishError(publishPayload)) return publishPayload;

        const providerPostId = getMetaCreatedId(publishPayload);
        const permalink = providerPostId
            ? await getMetaPermalink({
                  provider: this.name,
                  fetchImpl: this.fetchImpl,
                  baseUrl,
                  objectId: providerPostId,
                  accessToken: credentials.accessToken,
              })
            : '';

        return normalizeMetaPublishResult({
            provider: this.name,
            providerPostId,
            permalink,
            metadata: {
                destination: credentials.destination,
                mediaContainerId: container.containerId,
                graphVersion: credentials.graphVersion,
            },
        });
    }

    private async createContainer(
        input: SocialPostInput,
        credentials: {
            accessToken: string;
            destination: string;
        },
        baseUrl: string,
    ): Promise<{ ok: true; containerId: string } | SocialPublishError> {
        if (input.postType === 'carousel') {
            return await this.createCarouselContainer(
                input,
                credentials,
                baseUrl,
            );
        }

        const media = input.mediaUrls?.[0];
        if (!media) {
            return invalidRequest('Instagram media URL is required.');
        }

        const params = new URLSearchParams({
            access_token: credentials.accessToken,
        });
        const caption = input.body || input.title;
        if (caption) params.set('caption', caption);

        if (input.postType === 'story') {
            params.set('media_type', 'STORIES');
        } else if (input.postType === 'reel') {
            params.set('media_type', 'REELS');
        } else if (input.postType === 'video') {
            params.set('media_type', 'VIDEO');
        }

        if (media.type === 'video' || input.postType === 'reel') {
            params.set('video_url', media.url);
        } else {
            params.set('image_url', media.url);
        }

        const payload = await postMetaForm({
            provider: this.name,
            fetchImpl: this.fetchImpl,
            url: `${baseUrl}/${credentials.destination}/media`,
            params,
        });
        if (isSocialPublishError(payload)) return payload;

        const containerId = getMetaCreatedId(payload);
        return containerId
            ? { ok: true, containerId }
            : {
                  ok: false,
                  code: 'provider_unavailable',
                  message: 'Instagram container creation returned no id.',
                  retriable: true,
              };
    }

    private async createCarouselContainer(
        input: SocialPostInput,
        credentials: {
            accessToken: string;
            destination: string;
        },
        baseUrl: string,
    ): Promise<{ ok: true; containerId: string } | SocialPublishError> {
        const mediaUrls = input.mediaUrls ?? [];
        if (mediaUrls.length < 2) {
            return invalidRequest(
                'Instagram carousel publishing requires at least two media URLs.',
            );
        }

        const childContainerIds: string[] = [];
        for (const media of mediaUrls) {
            const params = new URLSearchParams({
                access_token: credentials.accessToken,
                is_carousel_item: 'true',
            });
            if (media.type === 'video') {
                params.set('media_type', 'VIDEO');
                params.set('video_url', media.url);
            } else {
                params.set('image_url', media.url);
            }

            const childPayload = await postMetaForm({
                provider: this.name,
                fetchImpl: this.fetchImpl,
                url: `${baseUrl}/${credentials.destination}/media`,
                params,
            });
            if (isSocialPublishError(childPayload)) return childPayload;

            const childContainerId = getMetaCreatedId(childPayload);
            if (!childContainerId) {
                return {
                    ok: false,
                    code: 'provider_unavailable',
                    message: 'Instagram carousel item creation returned no id.',
                    retriable: true,
                };
            }
            childContainerIds.push(childContainerId);
        }

        const params = new URLSearchParams({
            access_token: credentials.accessToken,
            media_type: 'CAROUSEL',
            children: childContainerIds.join(','),
        });
        const caption = input.body || input.title;
        if (caption) params.set('caption', caption);

        const payload = await postMetaForm({
            provider: this.name,
            fetchImpl: this.fetchImpl,
            url: `${baseUrl}/${credentials.destination}/media`,
            params,
        });
        if (isSocialPublishError(payload)) return payload;

        const containerId = getMetaCreatedId(payload);
        return containerId
            ? { ok: true, containerId }
            : {
                  ok: false,
                  code: 'provider_unavailable',
                  message: 'Instagram carousel creation returned no id.',
                  retriable: true,
              };
    }
}

function isSocialPublishError(value: unknown): value is SocialPublishError {
    return Boolean(value && typeof value === 'object' && 'ok' in value);
}
