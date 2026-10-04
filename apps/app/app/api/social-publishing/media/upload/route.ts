import { handleUpload } from '@vercel/blob/client';
import { withAuth } from '../../../../../lib/auth/auth';
import {
    isSocialProvider,
    type SocialProviderDefinition,
} from '../../../../../src/social/providers/definitions';

const MAX_SOCIAL_MEDIA_SIZE_BYTES = 100 * 1024 * 1024;
const MAX_PATH_SEGMENT_LENGTH = 80;

type SocialUploadPayload = {
    provider: SocialProviderDefinition['name'];
    providerAccountKey: string;
};

function getSocialUploadPayload(clientPayload: string | null) {
    if (!clientPayload) {
        throw new Error('Social media upload payload is required');
    }

    let parsedPayload: unknown;
    try {
        parsedPayload = JSON.parse(clientPayload);
    } catch {
        throw new Error('Invalid social media upload payload');
    }

    if (!parsedPayload || typeof parsedPayload !== 'object') {
        throw new Error('Invalid social media upload payload');
    }

    const provider = Reflect.get(parsedPayload, 'provider');
    const providerAccountKey = Reflect.get(parsedPayload, 'providerAccountKey');

    if (typeof provider !== 'string' || !isSocialProvider(provider)) {
        throw new Error('Invalid social media provider');
    }
    if (
        typeof providerAccountKey !== 'string' ||
        providerAccountKey.trim().length === 0
    ) {
        throw new Error('Invalid social media account');
    }

    return {
        provider,
        providerAccountKey: providerAccountKey.trim(),
    } satisfies SocialUploadPayload;
}

function toPathSegment(value: string) {
    const normalized = value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, MAX_PATH_SEGMENT_LENGTH);

    return normalized || 'default';
}

function getSocialUploadPathPrefix(payload: SocialUploadPayload) {
    return `social/${payload.provider}/${toPathSegment(payload.providerAccountKey)}/`;
}

function validateUploadPath(pathname: string, payload: SocialUploadPayload) {
    if (pathname.includes('..') || pathname.includes('\\')) {
        throw new Error('Invalid upload path');
    }

    if (!pathname.startsWith(getSocialUploadPathPrefix(payload))) {
        throw new Error('Invalid upload path');
    }
}

export async function POST(request: Request) {
    return await withAuth(['admin'], async () => {
        try {
            const body = await request.json();
            const json = await handleUpload({
                request,
                body,
                onBeforeGenerateToken: async (pathname, clientPayload) => {
                    const payload = getSocialUploadPayload(clientPayload);
                    validateUploadPath(pathname, payload);

                    return {
                        allowedContentTypes: ['image/*', 'video/*'],
                        maximumSizeInBytes: MAX_SOCIAL_MEDIA_SIZE_BYTES,
                        tokenPayload: clientPayload,
                    };
                },
            });

            return Response.json(json);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Unable to prepare social media upload';

            return Response.json({ error: message }, { status: 400 });
        }
    });
}
