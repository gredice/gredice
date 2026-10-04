import { expect, test } from '@playwright/experimental-ct-react';
import { FarmPostHogProvider } from './FarmPostHogProvider';
import { sanitizeFarmVercelAnalyticsEvent } from './FarmWebAnalytics';
import {
    createFarmPostHogOptions,
    farmPostHogLegacySensitivePersistenceKeys,
    farmPostHogPropertyDenylist,
    getFarmAnalyticsSafeUrl,
    purgeLegacyFarmPostHogPersistence,
    sanitizeFarmPostHogEvent,
} from './farmAnalyticsPrivacy';

const privateSentinels = [
    'private-note-4157',
    'https://photos.example/private.jpg',
    '45.812345',
    '15.912345',
    '/raised-beds/987654',
] as const;

test('removes SDK-added routes and private fields from the complete PostHog envelope', () => {
    const event = {
        $set: {
            last_location: '45.812345,15.912345',
            safe_account_kind: 'farmer',
        },
        $set_once: {
            $initial_current_url:
                'https://farma.gredice.com/raised-beds/987654?token=secret',
            $initial_pathname: '/raised-beds/987654',
            $search_keyword: 'private-note-4157',
            safe_first_surface: 'farm',
            utm_campaign: 'private-note-4157',
        },
        event: '$pageview',
        properties: {
            $current_url:
                'https://farma.gredice.com/operations/987654?token=secret',
            $pathname: '/operations/987654',
            $prev_pageview_pathname: '/raised-beds/987654',
            $session_entry_pathname: '/raised-beds/987654',
            $session_entry_referrer: 'https://private.example/source',
            $session_entry_url:
                'https://farma.gredice.com/raised-beds/987654?token=secret',
            title: 'Private raised bed 987654',
            nested: {
                coordinates: ['45.812345', '15.912345'],
                proof: {
                    photo_url: 'https://photos.example/private.jpg',
                    task_note: 'private-note-4157',
                },
                safe_state: 'actionable',
            },
            route_group: 'operations',
            surface: 'farm',
        },
        uuid: 'test-event',
    };

    expect(sanitizeFarmPostHogEvent(event)).toEqual({
        $set: { safe_account_kind: 'farmer' },
        $set_once: { safe_first_surface: 'farm' },
        event: '$pageview',
        properties: {
            nested: {
                proof: {},
                safe_state: 'actionable',
            },
            route_group: 'operations',
            surface: 'farm',
        },
        uuid: 'test-event',
    });

    const serializedEvent = JSON.stringify(event);
    for (const sentinel of privateSentinels) {
        expect(serializedEvent).not.toContain(sentinel);
    }
});

test('denylist covers every current PostHog route and session-entry property', () => {
    expect(farmPostHogPropertyDenylist).toEqual(
        expect.arrayContaining([
            '$current_url',
            '$initial_current_url',
            '$initial_pathname',
            '$pathname',
            '$prev_pageview_pathname',
            '$session_entry_pathname',
            '$session_entry_referrer',
            '$session_entry_referring_domain',
            '$session_entry_url',
        ]),
    );
});

test('disables unsanitized flags requests and every automatic capture surface', () => {
    const options = createFarmPostHogOptions({
        apiHost: '/ingest',
        hostname: 'farma.gredice.com',
    });

    expect(options).toMatchObject({
        advanced_disable_flags: true,
        api_host: '/ingest',
        autocapture: false,
        before_send: sanitizeFarmPostHogEvent,
        capture_exceptions: false,
        capture_pageleave: false,
        capture_pageview: false,
        disable_persistence: true,
        disable_session_recording: true,
        save_campaign_params: false,
        save_referrer: false,
        tracing_headers: ['farma.gredice.com'],
    });
});

test('purges legacy sensitive properties from durable and session analytics state', () => {
    const durableProperties: string[] = [];
    const sessionProperties: string[] = [];

    purgeLegacyFarmPostHogPersistence({
        unregister: (property) => durableProperties.push(property),
        unregister_for_session: (property) => sessionProperties.push(property),
    });

    for (const property of [
        '$initial_person_info',
        '$client_session_props',
        '$session_entry_url',
        '$referrer',
        'utm_campaign',
        'gclid',
        'ph_keyword',
    ]) {
        expect(durableProperties).toContain(property);
        expect(sessionProperties).toContain(property);
    }
    expect(durableProperties).toEqual([
        ...farmPostHogLegacySensitivePersistenceKeys,
    ]);
    expect(sessionProperties).toEqual(durableProperties);
});

test('removes the legacy PostHog browser store when the provider initializes', async ({
    mount,
    page,
}) => {
    const apiKey = 'phc_farm_privacy_migration_test';
    const persistenceKey = `ph_${apiKey}_posthog`;
    const legacyValue = JSON.stringify({
        $initial_person_info: {
            referrer: 'https://private.example/source',
            url: 'https://farma.gredice.com/raised-beds/987654?token=secret#proof',
        },
        distinct_id: 'legacy-browser-id',
    });

    await page.evaluate(
        ({ key, value }) => {
            localStorage.setItem(key, value);
            sessionStorage.setItem(key, value);
        },
        { key: persistenceKey, value: legacyValue },
    );
    await page.context().addCookies([
        {
            name: persistenceKey,
            sameSite: 'Lax',
            url: new URL(page.url()).origin,
            value: encodeURIComponent(legacyValue),
        },
    ]);

    await mount(
        <FarmPostHogProvider apiHost="/ingest" apiKey={apiKey}>
            <div>Spremno</div>
        </FarmPostHogProvider>,
    );

    await expect
        .poll(() =>
            page.evaluate((key) => {
                return {
                    cookie: document.cookie.includes(`${key}=`),
                    local: localStorage.getItem(key),
                    session: sessionStorage.getItem(key),
                };
            }, persistenceKey),
        )
        .toEqual({ cookie: false, local: null, session: null });
});

test('normalizes Vercel pageview and event URLs without IDs, query values, or fragments', () => {
    expect(
        sanitizeFarmVercelAnalyticsEvent({
            type: 'pageview',
            url: 'https://farma.gredice.com/raised-beds/987654?token=secret#proof',
        }),
    ).toEqual({
        type: 'pageview',
        url: 'https://farma.gredice.com/raised-beds/:raisedBedId',
    });
    expect(
        sanitizeFarmVercelAnalyticsEvent({
            type: 'event',
            url: 'https://farma.gredice.com/operations/987654?note=private-note-4157',
        }),
    ).toEqual({
        type: 'event',
        url: 'https://farma.gredice.com/operations/:operationId',
    });
    expect(
        getFarmAnalyticsSafeUrl('/plants/987654?photo=private.jpg#details'),
    ).toBe('/plants/:plantSortId');
});

test('keeps unknown paths and invalid relative input inside a fixed safe bucket', () => {
    expect(
        getFarmAnalyticsSafeUrl(
            'https://farma.gredice.com/private/private-note-4157',
        ),
    ).toBe('https://farma.gredice.com/other');
    expect(getFarmAnalyticsSafeUrl('not a URL')).toBe('/other');
    expect(getFarmAnalyticsSafeUrl('http://[')).toBe('/other');
    expect(sanitizeFarmPostHogEvent(null)).toBeNull();
});
