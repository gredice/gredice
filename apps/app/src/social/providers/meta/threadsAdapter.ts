import 'server-only';

import {
    readSocialProviderEnv,
    readSocialProviderRuntimeConfig,
    resolveConfiguredDestination,
} from '../config';
import {
    type FetchLike,
    getNestedString,
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

const THREADS_BASE_URL = 'https://graph.threads.net/v1.0';

export class ThreadsProviderAdapter implements SocialProviderAdapter {
    readonly name = 'threads' as const;
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
                message: 'Threads access token is missing.',
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

        const container = await this.createContainer(
            input,
            destination.destination,
            accessToken,
        );
        if (!container.ok) return container;

        const publishPayload = await this.postForm(
            `${THREADS_BASE_URL}/${destination.destination}/threads_publish`,
            new URLSearchParams({
                creation_id: container.containerId,
                access_token: accessToken,
            }),
        );
        if (isSocialPublishError(publishPayload)) return publishPayload;

        const providerPostId =
            getString(publishPayload, 'id') ??
            getNestedString(publishPayload, 'data', 'id');
        const permalink = providerPostId
            ? await this.getPermalink(providerPostId, accessToken)
            : '';

        if (!providerPostId) {
            return {
                ok: false,
                code: 'provider_unavailable',
                message: 'Threads publish succeeded without post id.',
                retriable: true,
            };
        }

        return {
            ok: true,
            providerPostId,
            permalink,
            metadata: {
                destination: destination.destination,
                mediaContainerId: container.containerId,
            },
        };
    }

    private async createContainer(
        input: SocialPostInput,
        destination: string,
        accessToken: string,
    ): Promise<{ ok: true; containerId: string } | SocialPublishError> {
        if (input.postType === 'carousel') {
            return await this.createCarouselContainer(
                input,
                destination,
                accessToken,
            );
        }

        const params = new URLSearchParams({ access_token: accessToken });
        const text = [input.body || input.title, input.url]
            .filter(Boolean)
            .join('\n');
        if (text) params.set('text', text);

        const media = input.mediaUrls?.[0];
        if (media?.type === 'image') {
            params.set('media_type', 'IMAGE');
            params.set('image_url', media.url);
        } else if (media?.type === 'video') {
            params.set('media_type', 'VIDEO');
            params.set('video_url', media.url);
        } else {
            if (!text) {
                return invalidRequest(
                    'Threads text posts require body text or a URL.',
                );
            }
            params.set('media_type', 'TEXT');
        }

        const payload = await this.postForm(
            `${THREADS_BASE_URL}/${destination}/threads`,
            params,
        );
        if (isSocialPublishError(payload)) return payload;

        const containerId =
            getString(payload, 'id') ?? getNestedString(payload, 'data', 'id');
        return containerId
            ? { ok: true, containerId }
            : {
                  ok: false,
                  code: 'provider_unavailable',
                  message: 'Threads container creation returned no id.',
                  retriable: true,
              };
    }

    private async createCarouselContainer(
        input: SocialPostInput,
        destination: string,
        accessToken: string,
    ): Promise<{ ok: true; containerId: string } | SocialPublishError> {
        const mediaUrls = input.mediaUrls ?? [];
        if (mediaUrls.length < 2) {
            return invalidRequest(
                'Threads carousel publishing requires at least two media URLs.',
            );
        }

        const childIds: string[] = [];
        for (const media of mediaUrls) {
            const params = new URLSearchParams({
                access_token: accessToken,
                is_carousel_item: 'true',
                media_type: media.type === 'video' ? 'VIDEO' : 'IMAGE',
            });
            params.set(
                media.type === 'video' ? 'video_url' : 'image_url',
                media.url,
            );

            const childPayload = await this.postForm(
                `${THREADS_BASE_URL}/${destination}/threads`,
                params,
            );
            if (isSocialPublishError(childPayload)) return childPayload;

            const childId =
                getString(childPayload, 'id') ??
                getNestedString(childPayload, 'data', 'id');
            if (!childId) {
                return {
                    ok: false,
                    code: 'provider_unavailable',
                    message: 'Threads carousel item returned no id.',
                    retriable: true,
                };
            }
            childIds.push(childId);
        }

        const params = new URLSearchParams({
            access_token: accessToken,
            media_type: 'CAROUSEL',
            children: childIds.join(','),
        });
        const text = [input.body || input.title, input.url]
            .filter(Boolean)
            .join('\n');
        if (text) params.set('text', text);

        const payload = await this.postForm(
            `${THREADS_BASE_URL}/${destination}/threads`,
            params,
        );
        if (isSocialPublishError(payload)) return payload;

        const containerId =
            getString(payload, 'id') ?? getNestedString(payload, 'data', 'id');
        return containerId
            ? { ok: true, containerId }
            : {
                  ok: false,
                  code: 'provider_unavailable',
                  message: 'Threads carousel creation returned no id.',
                  retriable: true,
              };
    }

    private async postForm(url: string, params: URLSearchParams) {
        let response: Response;
        try {
            response = await this.fetchImpl(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: params,
            });
        } catch (error) {
            return {
                ok: false,
                code: 'provider_unavailable',
                message: 'Threads publish request failed.',
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

    private async getPermalink(objectId: string, accessToken: string) {
        const url = new URL(`${THREADS_BASE_URL}/${objectId}`);
        url.searchParams.set('fields', 'permalink');
        url.searchParams.set('access_token', accessToken);
        try {
            const response = await this.fetchImpl(url);
            if (!response.ok) return '';
            const payload = await readJsonResponse(response);
            return getString(payload, 'permalink') ?? '';
        } catch (error) {
            console.warn('Threads permalink lookup failed.', error);
            return '';
        }
    }
}

function isSocialPublishError(value: unknown): value is SocialPublishError {
    return Boolean(value && typeof value === 'object' && 'ok' in value);
}
