import 'server-only';

import {
    readSocialProviderEnv,
    readSocialProviderRuntimeConfig,
    resolveConfiguredDestination,
} from '../config';
import {
    type FetchLike,
    getArray,
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

export class WhatsAppProviderAdapter implements SocialProviderAdapter {
    readonly name = 'whatsapp' as const;
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

        const recipient = resolveConfiguredDestination(
            this.name,
            input.destination,
            config,
        );
        if (!recipient.ok) {
            return {
                ok: false,
                code: recipient.code,
                message: recipient.message,
                retriable: false,
            };
        }

        const accessToken = readSocialProviderEnv(this.name, 'ACCESS_TOKEN', {
            providerAccountKey: input.providerAccountKey,
        });
        const phoneNumberId = readSocialProviderEnv(
            this.name,
            'PHONE_NUMBER_ID',
            { providerAccountKey: input.providerAccountKey },
        );
        const graphVersion =
            readSocialProviderEnv(this.name, 'GRAPH_VERSION', {
                providerAccountKey: input.providerAccountKey,
            }) || 'v24.0';
        if (!accessToken || !phoneNumberId) {
            return {
                ok: false,
                code: 'missing_credentials',
                message: 'WhatsApp requires ACCESS_TOKEN and PHONE_NUMBER_ID.',
                retriable: false,
            };
        }

        const body = this.createMessageBody(input, recipient.destination);
        if (isSocialPublishError(body)) return body;

        let response: Response;
        try {
            response = await this.fetchImpl(
                `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(body),
                },
            );
        } catch (error) {
            return {
                ok: false,
                code: 'provider_unavailable',
                message: 'WhatsApp message request failed.',
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

        const message = getArray(payload, 'messages').find(
            (entry) => typeof entry === 'object' && entry !== null,
        );
        const providerPostId = getString(message, 'id');
        if (!providerPostId) {
            return {
                ok: false,
                code: 'provider_unavailable',
                message: 'WhatsApp response returned no message id.',
                retriable: true,
            };
        }

        return {
            ok: true,
            providerPostId,
            permalink: '',
            metadata: {
                destination: recipient.destination,
                phoneNumberId,
                graphVersion,
            },
        };
    }

    private createMessageBody(
        input: SocialPostInput,
        recipient: string,
    ): Record<string, unknown> | SocialPublishError {
        const caption = [input.body || input.title, input.url]
            .filter(Boolean)
            .join('\n');
        const media = input.mediaUrls?.[0];

        if (!media) {
            if (!caption) {
                return invalidRequest(
                    'WhatsApp messages require text or one media URL.',
                );
            }
            return {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: recipient,
                type: 'text',
                text: {
                    preview_url: Boolean(input.url),
                    body: caption,
                },
            };
        }

        if (media.type === 'video') {
            return {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: recipient,
                type: 'video',
                video: {
                    link: media.url,
                    caption,
                },
            };
        }

        return {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: recipient,
            type: 'image',
            image: {
                link: media.url,
                caption,
            },
        };
    }
}

function isSocialPublishError(value: unknown): value is SocialPublishError {
    return Boolean(value && typeof value === 'object' && 'ok' in value);
}
