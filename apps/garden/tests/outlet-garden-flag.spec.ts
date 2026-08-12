import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { outletGardenEnabledByDefault } from '../app/outletGardenFlagDefault';

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

test('flag discovery resolves managed Vercel provider metadata', () => {
    const discoverySource = readFileSync(
        new URL('../app/.well-known/vercel/flags/route.ts', import.meta.url),
        'utf8',
    );

    expect(discoverySource).toContain(
        "import { getProviderData } from '@flags-sdk/vercel';",
    );
    expect(discoverySource).toContain(
        "import { createFlagsDiscoveryEndpoint } from 'flags/next';",
    );

    const flagsSource = readFileSync(
        new URL('../app/flags.ts', import.meta.url),
        'utf8',
    );
    expect(flagsSource).toContain("key: 'enableOutletGardenCommerce'");
    expect(flagsSource).toMatch(
        /enableOutletGardenCommerceFlag[\s\S]*?adapter: vercelAdapter,[\s\S]*?defaultValue: false,/u,
    );
});
