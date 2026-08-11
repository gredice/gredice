import { expect, test } from '@playwright/test';
import { outletGardenEnabledByDefault } from '../app/outletGardenFlagDefault';

test('Outlet garden defaults off in production and on in preview', () => {
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
});
