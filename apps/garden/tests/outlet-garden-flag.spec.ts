import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { createAccessProof } from 'flags';
import { outletGardenEnabledByDefault } from '../app/outletGardenFlagDefault';
import { outletGardenTestFlagsSecret } from '../playwright/outletGardenFlagTestSupport';

const gardenFlagKeys = [
    'deliveryChargeAtCheckout',
    'addressDistanceVerification',
    'enableDebugCloseup',
    'enableDebugHud',
    'enableSuncokretDebug',
    'enableGardenAvatar',
    'enableOutletGarden',
    'enableOutletGardenCommerce',
    'enableAdvancedSowing',
    'enableRaisedBedNotificationBubbles',
];

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

test('Outlet garden provider fallback stays safe across environments', () => {
    expect(
        outletGardenEnabledByDefault({
            NODE_ENV: 'production',
            VERCEL_ENV: 'production',
        }),
    ).toBe(false);
    expect(
        outletGardenEnabledByDefault({
            NODE_ENV: 'production',
            VERCEL_ENV: 'preview',
        }),
    ).toBe(true);
    expect(
        outletGardenEnabledByDefault({
            NODE_ENV: 'development',
        }),
    ).toBe(true);
});

test('flag discovery merges all code-defined and managed Vercel metadata', () => {
    const discoverySource = readFileSync(
        new URL('../app/.well-known/vercel/flags/route.ts', import.meta.url),
        'utf8',
    );

    expect(discoverySource).toContain(
        'import { getProviderData as getVercelProviderData } from',
    );
    expect(discoverySource).toContain(
        "import { mergeProviderData } from 'flags';",
    );
    expect(discoverySource).toContain(
        'import { createFlagsDiscoveryEndpoint, getProviderData } from',
    );
    expect(discoverySource).toMatch(
        /mergeProviderData\(\[\s*getProviderData\(flags\),\s*getVercelProviderData\(flags\),?\s*\]\)/u,
    );

    const flagsSource = readFileSync(
        new URL('../app/flags.ts', import.meta.url),
        'utf8',
    );
    const discoveredFlagKeys = Array.from(
        flagsSource.matchAll(/key: '([^']+)'/gu),
        (match) => match[1],
    );

    expect(discoveredFlagKeys).toEqual(gardenFlagKeys);
    expect(flagsSource).toMatch(
        /enableOutletGardenCommerceFlag[\s\S]*?adapter: vercelAdapter,[\s\S]*?defaultValue: false,/u,
    );
    expect(flagsSource).toMatch(
        /enableRaisedBedNotificationBubblesFlag[\s\S]*?adapter: vercelAdapter,[\s\S]*?defaultValue: false,/u,
    );
});

test('authenticated discovery endpoint exposes every Garden flag', async ({
    request,
}) => {
    const accessProof = await createAccessProof(
        outletGardenTestFlagsSecret,
        '1h',
    );
    const response = await request.get('/.well-known/vercel/flags', {
        headers: { Authorization: `Bearer ${accessProof}` },
    });

    expect(response.status()).toBe(200);
    expect(response.headers()['x-flags-sdk-version']).toBeTruthy();

    const responseBody: unknown = await response.json();
    expect(isRecord(responseBody)).toBe(true);
    if (!isRecord(responseBody)) {
        throw new Error('Expected discovery response to be an object.');
    }

    const { definitions } = responseBody;
    expect(isRecord(definitions)).toBe(true);
    if (!isRecord(definitions)) {
        throw new Error('Expected discovery definitions to be an object.');
    }

    expect(Object.keys(definitions).toSorted()).toEqual(
        gardenFlagKeys.toSorted(),
    );
});
