import type { PostHogConfig } from 'posthog-js';
import { getFarmAnalyticsPage } from './farmAnalyticsPage';

type SanitizablePostHogEvent = {
    $set?: Record<string, unknown>;
    $set_once?: Record<string, unknown>;
    properties: Record<string, unknown>;
};

const sensitivePropertyKeyFragments = [
    'campaign',
    'clid',
    'coordinate',
    'gbraid',
    'href',
    'image',
    'latitude',
    'location',
    'longitude',
    'note',
    'path',
    'photo',
    'referrer',
    'referring',
    'search_',
    'title',
    'utm_',
    'url',
    'wbraid',
] as const;

export const farmPostHogPropertyDenylist = [
    '$current_url',
    '$initial_current_url',
    '$initial_pathname',
    '$initial_referrer',
    '$initial_referring_domain',
    '$pathname',
    '$prev_pageview_pathname',
    '$referrer',
    '$referring_domain',
    '$session_entry_pathname',
    '$session_entry_referrer',
    '$session_entry_referring_domain',
    '$session_entry_url',
    'current_url',
    'pathname',
    'referrer',
    'referring_domain',
    'request_url',
    'title',
] as const;

const farmPostHogCampaignPropertyKeys = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'utm_term',
    'gad_source',
    'mc_cid',
    'gclid',
    'gclsrc',
    'dclid',
    'gbraid',
    'wbraid',
    'fbclid',
    'msclkid',
    'twclid',
    'li_fat_id',
    'igshid',
    'ttclid',
    'rdt_cid',
    'epik',
    'qclid',
    'sccid',
    'irclid',
    '_kx',
] as const;

export const farmPostHogLegacySensitivePersistenceKeys = [
    '$initial_person_info',
    '$initial_campaign_params',
    '$initial_referrer_info',
    '$client_session_props',
    '$search_engine',
    'ph_keyword',
    ...farmPostHogCampaignPropertyKeys,
    ...farmPostHogPropertyDenylist,
] as const;

type FarmPostHogPersistenceClient = {
    unregister: (property: string) => void;
    unregister_for_session: (property: string) => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isSensitivePropertyKey(key: string) {
    const normalizedKey = key.toLowerCase();

    return (
        normalizedKey.startsWith('$session_entry_') ||
        sensitivePropertyKeyFragments.some((fragment) =>
            normalizedKey.includes(fragment),
        )
    );
}

function removeSensitiveProperties(
    value: unknown,
    visited = new WeakSet<object>(),
) {
    if (!isRecord(value) || visited.has(value)) {
        return;
    }

    visited.add(value);
    for (const [key, nestedValue] of Object.entries(value)) {
        if (isSensitivePropertyKey(key)) {
            delete value[key];
            continue;
        }

        if (Array.isArray(nestedValue)) {
            for (const item of nestedValue) {
                removeSensitiveProperties(item, visited);
            }
            continue;
        }

        removeSensitiveProperties(nestedValue, visited);
    }
}

export function sanitizeFarmPostHogEvent<
    Event extends SanitizablePostHogEvent | null,
>(event: Event): Event {
    if (!event) {
        return event;
    }

    removeSensitiveProperties(event.properties);
    removeSensitiveProperties(event.$set);
    removeSensitiveProperties(event.$set_once);

    return event;
}

export function purgeLegacyFarmPostHogPersistence(
    client: FarmPostHogPersistenceClient,
) {
    for (const property of farmPostHogLegacySensitivePersistenceKeys) {
        client.unregister(property);
        client.unregister_for_session(property);
    }
}

export function createFarmPostHogOptions({
    apiHost,
    hostname,
    uiHost,
}: {
    apiHost: string;
    hostname: string;
    uiHost?: string;
}) {
    return {
        advanced_disable_flags: true,
        api_host: apiHost,
        autocapture: false,
        before_send: sanitizeFarmPostHogEvent,
        capture_exceptions: false,
        capture_pageleave: false,
        capture_pageview: false,
        debug: process.env.NODE_ENV === 'development',
        defaults: '2026-01-30',
        disable_capture_url_hashes: true,
        disable_persistence: true,
        disable_session_recording: true,
        mask_personal_data_properties: true,
        opt_out_capturing_persistence_type: 'cookie',
        opt_out_persistence_by_default: true,
        persistence: 'localStorage+cookie',
        property_denylist: [...farmPostHogPropertyDenylist],
        save_campaign_params: false,
        save_referrer: false,
        tracing_headers: hostname ? [hostname] : undefined,
        ui_host: uiHost ?? null,
    } satisfies Partial<PostHogConfig>;
}

export function getFarmAnalyticsSafeUrl(rawUrl: string) {
    try {
        const absoluteUrl = new URL(rawUrl);
        const page = getFarmAnalyticsPage(absoluteUrl.pathname);

        return `${absoluteUrl.origin}${page.path}`;
    } catch {
        try {
            const relativeUrl = new URL(rawUrl, 'https://farm.invalid');
            return getFarmAnalyticsPage(relativeUrl.pathname).path;
        } catch {
            return '/other';
        }
    }
}
