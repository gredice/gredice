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
    mapHttpProviderError,
    providerDisabled,
    readJsonResponse,
} from '../http';
import type {
    SocialProviderName,
    SocialPublishError,
    SocialPublishResult,
} from '../types';

export type MetaProviderCredentials = {
    accessToken: string;
    graphVersion: string;
    destination: string;
};

export function readMetaProviderCredentials({
    provider,
    providerAccountKey,
    destination,
}: {
    provider: SocialProviderName;
    providerAccountKey: string;
    destination?: string;
}): MetaProviderCredentials | SocialPublishError {
    const config = readSocialProviderRuntimeConfig(provider, {
        providerAccountKey,
    });
    if (!config.enabled) return providerDisabled(provider);

    const resolvedDestination = resolveConfiguredDestination(
        provider,
        destination,
        config,
    );
    if (!resolvedDestination.ok) {
        return {
            ok: false,
            code: resolvedDestination.code,
            message: resolvedDestination.message,
            retriable: false,
        };
    }

    const accessToken = readSocialProviderEnv(provider, 'ACCESS_TOKEN', {
        providerAccountKey,
    });
    if (!accessToken) {
        return {
            ok: false,
            code: 'missing_credentials',
            message: `${provider} access token is missing.`,
            retriable: false,
        };
    }

    return {
        accessToken,
        destination: resolvedDestination.destination,
        graphVersion:
            readSocialProviderEnv(provider, 'GRAPH_VERSION', {
                providerAccountKey,
            }) ||
            readSocialProviderEnv('facebook', 'GRAPH_VERSION') ||
            'v24.0',
    };
}

export async function postMetaForm({
    provider,
    fetchImpl,
    url,
    params,
}: {
    provider: SocialProviderName;
    fetchImpl: FetchLike;
    url: string;
    params: URLSearchParams;
}): Promise<unknown | SocialPublishError> {
    let response: Response;
    try {
        response = await fetchImpl(url, {
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
            message: `${provider} publish request failed.`,
            retriable: true,
            details: {
                errorType: error instanceof Error ? error.name : typeof error,
            },
        };
    }

    const payload = await readJsonResponse(response);
    if (!response.ok) {
        return mapHttpProviderError(provider, response.status, payload);
    }

    return payload;
}

export async function getMetaPermalink({
    provider,
    fetchImpl,
    baseUrl,
    objectId,
    accessToken,
    field = 'permalink',
}: {
    provider: SocialProviderName;
    fetchImpl: FetchLike;
    baseUrl: string;
    objectId: string;
    accessToken: string;
    field?: 'permalink' | 'permalink_url';
}) {
    const url = new URL(`${baseUrl}/${objectId}`);
    url.searchParams.set('fields', field);
    url.searchParams.set('access_token', accessToken);

    try {
        const response = await fetchImpl(url);
        if (!response.ok) return '';
        const payload = await readJsonResponse(response);
        return getString(payload, field) ?? '';
    } catch (error) {
        console.warn(`${provider} permalink lookup failed.`, error);
        return '';
    }
}

export function normalizeMetaPublishResult({
    provider,
    providerPostId,
    permalink,
    metadata,
}: {
    provider: SocialProviderName;
    providerPostId: string | undefined;
    permalink?: string;
    metadata?: Record<string, unknown>;
}): SocialPublishResult {
    if (!providerPostId) {
        return {
            ok: false,
            code: 'provider_unavailable',
            message: `${provider} publish succeeded without post id.`,
            retriable: true,
        };
    }

    return {
        ok: true,
        providerPostId,
        permalink: permalink ?? '',
        metadata,
    };
}

export function getMetaCreatedId(payload: unknown) {
    return getString(payload, 'id') ?? getNestedString(payload, 'data', 'id');
}
