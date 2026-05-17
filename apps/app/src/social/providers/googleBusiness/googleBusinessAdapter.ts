import 'server-only';

import {
    readSocialProviderEnv,
    readSocialProviderRuntimeConfig,
    resolveConfiguredDestination,
} from '../config';
import {
    type FetchLike,
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

type GoogleTokenResponse = {
    accessToken?: string;
};

export class GoogleBusinessProviderAdapter implements SocialProviderAdapter {
    readonly name = 'google_business' as const;
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
        if (
            !/^accounts\/[^/]+\/locations\/[^/]+$/.test(destination.destination)
        ) {
            return {
                ok: false,
                code: 'invalid_destination',
                message:
                    'Google Business destination must be accounts/{accountId}/locations/{locationId}.',
                retriable: false,
            };
        }

        const token = await this.getAccessToken(input.providerAccountKey);
        if (isSocialPublishError(token)) return token;
        if (!token.accessToken) {
            return {
                ok: false,
                code: 'provider_unavailable',
                message: 'Google Business access token is missing.',
                retriable: true,
            };
        }

        const summary = [input.body || input.title, input.url]
            .filter(Boolean)
            .join('\n');
        if (!summary && !input.mediaUrls?.length) {
            return invalidRequest(
                'Google Business posts require text, URL, or one image.',
            );
        }

        const body: Record<string, unknown> = {
            languageCode:
                readSocialProviderEnv(this.name, 'LANGUAGE_CODE', {
                    providerAccountKey: input.providerAccountKey,
                }) || 'hr',
            summary,
            topicType: 'STANDARD',
        };
        const imageUrl = input.mediaUrls?.find(
            (media) => media.type !== 'video',
        )?.url;
        if (imageUrl) {
            body.media = [{ mediaFormat: 'PHOTO', sourceUrl: imageUrl }];
        }
        if (input.url) {
            body.callToAction = {
                actionType: 'LEARN_MORE',
                url: input.url,
            };
        }

        let response: Response;
        try {
            response = await this.fetchImpl(
                `https://mybusiness.googleapis.com/v4/${destination.destination}/localPosts`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token.accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(body),
                },
            );
        } catch (error) {
            return {
                ok: false,
                code: 'provider_unavailable',
                message: 'Google Business publish request failed.',
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

        const providerPostId = getString(payload, 'name');
        if (!providerPostId) {
            return {
                ok: false,
                code: 'provider_unavailable',
                message: 'Google Business publish returned no post name.',
                retriable: true,
            };
        }

        return {
            ok: true,
            providerPostId,
            permalink: getString(payload, 'searchUrl') ?? '',
            metadata: {
                destination: destination.destination,
                topicType: 'STANDARD',
            },
        };
    }

    private async getAccessToken(
        providerAccountKey: string,
    ): Promise<GoogleTokenResponse | SocialPublishError> {
        const accessToken = readSocialProviderEnv(this.name, 'ACCESS_TOKEN', {
            providerAccountKey,
        });
        if (accessToken) return { accessToken };

        const clientId = readSocialProviderEnv(this.name, 'CLIENT_ID', {
            providerAccountKey,
        });
        const clientSecret = readSocialProviderEnv(this.name, 'CLIENT_SECRET', {
            providerAccountKey,
        });
        const refreshToken = readSocialProviderEnv(this.name, 'REFRESH_TOKEN', {
            providerAccountKey,
        });
        if (!clientId || !clientSecret || !refreshToken) {
            return {
                ok: false,
                code: 'missing_credentials',
                message: [
                    'Google Business requires ACCESS_TOKEN or CLIENT_ID,',
                    'CLIENT_SECRET, and REFRESH_TOKEN.',
                ].join(' '),
                retriable: false,
            };
        }

        let response: Response;
        try {
            response = await this.fetchImpl(
                'https://oauth2.googleapis.com/token',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams({
                        client_id: clientId,
                        client_secret: clientSecret,
                        refresh_token: refreshToken,
                        grant_type: 'refresh_token',
                    }),
                },
            );
        } catch (error) {
            return {
                ok: false,
                code: 'provider_unavailable',
                message: 'Google OAuth token refresh failed.',
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

        const refreshedAccessToken = getString(payload, 'access_token');
        return refreshedAccessToken
            ? { accessToken: refreshedAccessToken }
            : {
                  ok: false,
                  code: 'provider_unavailable',
                  message: 'Google OAuth token refresh returned no token.',
                  retriable: true,
              };
    }
}

function isSocialPublishError(value: unknown): value is SocialPublishError {
    return Boolean(value && typeof value === 'object' && 'ok' in value);
}
