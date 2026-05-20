import 'server-only';

import type {
    SocialPostMediaUrl,
    SocialProviderName,
    SocialPublishError,
} from './types';

export type FetchLike = typeof fetch;

export type DownloadedMedia = {
    source: SocialPostMediaUrl;
    bytes: Buffer;
    base64: string;
    contentType: string;
    size: number;
};

export async function readJsonResponse(response: Response): Promise<unknown> {
    try {
        return await response.json();
    } catch {
        return null;
    }
}

export function providerDisabled(
    provider: SocialProviderName,
): SocialPublishError {
    return {
        ok: false,
        code: 'provider_disabled',
        message: `${provider} provider is disabled.`,
        retriable: false,
    };
}

export function missingCredentials(
    provider: SocialProviderName,
    message = `${provider} provider credentials are missing.`,
): SocialPublishError {
    return {
        ok: false,
        code: 'missing_credentials',
        message,
        retriable: false,
    };
}

export function invalidDestination(
    message: string,
    details?: Record<string, unknown>,
): SocialPublishError {
    return {
        ok: false,
        code: 'invalid_destination',
        message,
        retriable: false,
        details,
    };
}

export function invalidRequest(
    message: string,
    details?: Record<string, unknown>,
): SocialPublishError {
    return {
        ok: false,
        code: 'invalid_request',
        message,
        retriable: false,
        details,
    };
}

export function providerUnavailable(
    message: string,
    error?: unknown,
): SocialPublishError {
    if (error) {
        console.warn(message, error);
    }
    return {
        ok: false,
        code: 'provider_unavailable',
        message,
        retriable: true,
    };
}

export function mapHttpProviderError(
    provider: SocialProviderName,
    status: number,
    payload: unknown,
): SocialPublishError {
    if (status === 401 || status === 403) {
        return {
            ok: false,
            code: 'auth_failed',
            message: `${provider} rejected provider authentication.`,
            retriable: false,
            details: providerErrorDetails(status, payload),
        };
    }
    if (status === 429) {
        return {
            ok: false,
            code: 'rate_limited',
            message: `${provider} rate limit reached. Try again later.`,
            retriable: true,
            details: providerErrorDetails(status, payload),
        };
    }
    if (status >= 500) {
        return {
            ok: false,
            code: 'provider_unavailable',
            message: `${provider} is temporarily unavailable.`,
            retriable: true,
            details: providerErrorDetails(status, payload),
        };
    }

    return {
        ok: false,
        code: 'invalid_request',
        message: `${provider} rejected the post payload.`,
        retriable: false,
        details: providerErrorDetails(status, payload),
    };
}

export async function downloadMedia(
    mediaUrl: SocialPostMediaUrl,
    fetchImpl: FetchLike,
): Promise<DownloadedMedia | SocialPublishError> {
    let response: Response;
    try {
        response = await fetchImpl(mediaUrl.url);
    } catch (error) {
        return providerUnavailable(
            'Unable to download social media before provider upload.',
            error,
        );
    }

    if (!response.ok) {
        return {
            ok: false,
            code: 'provider_unavailable',
            message: 'Unable to download social media before provider upload.',
            retriable: response.status >= 500 || response.status === 429,
            details: { status: response.status },
        };
    }

    const contentType =
        response.headers.get('content-type')?.split(';')[0]?.trim() ||
        mediaUrlContentType(mediaUrl);
    const arrayBuffer = await response.arrayBuffer();
    const bytes = Buffer.from(arrayBuffer);

    return {
        source: mediaUrl,
        bytes,
        base64: bytes.toString('base64'),
        contentType,
        size: bytes.byteLength,
    };
}

export function getString(value: unknown, key: string): string | undefined {
    if (!isRecord(value)) return undefined;
    const field = value[key];
    return typeof field === 'string' && field.trim() ? field.trim() : undefined;
}

export function getNumber(value: unknown, key: string): number | undefined {
    if (!isRecord(value)) return undefined;
    const field = value[key];
    return typeof field === 'number' && Number.isFinite(field)
        ? field
        : undefined;
}

export function getRecord(
    value: unknown,
    key: string,
): Record<string, unknown> | null {
    if (!isRecord(value)) return null;
    const field = value[key];
    return isRecord(field) ? field : null;
}

export function getArray(value: unknown, key: string): unknown[] {
    if (!isRecord(value)) return [];
    const field = value[key];
    return Array.isArray(field) ? field : [];
}

export function getNestedString(
    value: unknown,
    firstKey: string,
    secondKey: string,
): string | undefined {
    return getString(getRecord(value, firstKey), secondKey);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function providerErrorDetails(
    status: number,
    payload: unknown,
): Record<string, unknown> {
    const error = getRecord(payload, 'error') ?? payload;
    return {
        status,
        providerErrorId:
            getString(error, 'providerErrorId') ??
            getString(error, 'fbtrace_id') ??
            getString(error, 'log_id') ??
            getString(error, 'logid'),
        reason:
            getString(error, 'reason') ??
            getString(error, 'message') ??
            getString(error, 'detail') ??
            getString(error, 'title'),
        errorCode:
            getString(error, 'code') ?? getNumber(error, 'code')?.toString(),
    };
}

function mediaUrlContentType(mediaUrl: SocialPostMediaUrl) {
    const url = new URL(mediaUrl.url);
    const pathname = url.pathname.toLowerCase();
    if (/\.(jpe?g|pjpeg)$/.test(pathname)) return 'image/jpeg';
    if (/\.png$/.test(pathname)) return 'image/png';
    if (/\.gif$/.test(pathname)) return 'image/gif';
    if (/\.webp$/.test(pathname)) return 'image/webp';
    if (/\.mov$/.test(pathname)) return 'video/quicktime';
    if (/\.webm$/.test(pathname)) return 'video/webm';
    return mediaUrl.type === 'video' ? 'video/mp4' : 'image/jpeg';
}
