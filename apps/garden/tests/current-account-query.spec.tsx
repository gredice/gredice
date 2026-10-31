import { expect, test } from '@playwright/experimental-ct-react';
import { CurrentAccountQueryFixture } from '../../../packages/game/tests/CurrentAccountQueryFixture';

test('scene isolation blocks account requests until explicitly re-enabled', async ({
    mount,
    page,
}) => {
    const requests: string[] = [];
    await page.route('**/api/accounts/current{,/sunflowers}', async (route) => {
        requests.push(new URL(route.request().url()).pathname);
        await route.fulfill({ status: 401, json: {} });
    });
    const fixture = await mount(
        <CurrentAccountQueryFixture authenticated={false} />,
    );
    await expect(fixture).toHaveText('idle');
    await page.waitForTimeout(200);
    expect(requests).toEqual([]);
    await fixture.update(<CurrentAccountQueryFixture />);
    await expect.poll(() => requests.length).toBe(2);
});

test('explicit disable wins and consumers outside a scene retain the default', async ({
    mount,
    page,
}) => {
    let requests = 0;
    await page.route('**/api/accounts/current{,/sunflowers}', async (route) => {
        requests += 1;
        await route.fulfill({ status: 401, json: {} });
    });
    const fixture = await mount(
        <CurrentAccountQueryFixture enabled={false} withGameState={false} />,
    );
    await expect(fixture).toHaveText('idle');
    await page.waitForTimeout(200);
    expect(requests).toBe(0);
    await fixture.update(<CurrentAccountQueryFixture withGameState={false} />);
    await expect.poll(() => requests).toBe(2);
});
