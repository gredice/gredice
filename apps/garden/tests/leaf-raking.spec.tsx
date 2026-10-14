import { expect, test } from '@playwright/experimental-ct-react';
import { LeafRakingFixture } from '../../../packages/game/tests/LeafRakingFixture';

test.use({ hasTouch: true });
test.setTimeout(60000);
async function report(page: import('@playwright/test').Page) {
    return JSON.parse(
        (await page.getByTestId('raking-report').textContent()) || '{}',
    );
}
async function ready(page: import('@playwright/test').Page) {
    await expect
        .poll(async () => (await report(page)).ready, { timeout: 20000 })
        .toBe(true);
    await page
        .getByRole('button', { name: 'Ukrasno jesensko lišće', exact: true })
        .click();
    await expect(
        page.getByRole('button', { name: 'Razgrni lišće', exact: true }),
    ).toBeEnabled();
}

test('pointer and keyboard trigger a bounded real leaf puff at the selected placed decoration, with cooldown and no writes', async ({
    mount,
    page,
}) => {
    const writes: string[] = [];
    page.on('request', (request) => {
        if (request.method() !== 'GET') writes.push(request.url());
    });
    await mount(<LeafRakingFixture />);
    await ready(page);
    const original = await page.getByTestId('raking-garden').textContent();
    await page
        .getByRole('combobox', { name: 'Ukrasno jesensko lišće' })
        .selectOption('pile');
    const action = page.getByRole('button', {
        name: 'Razgrni lišće',
        exact: true,
    });
    await action.click();
    await expect(action).toBeDisabled();
    await expect.poll(async () => (await report(page)).rendered?.peak).toBe(8);
    const first = await report(page);
    expect(first.origin[0]).toBeCloseTo(1.5 - 0.24);
    expect(first.origin[1]).toBeCloseTo(0.5);
    await expect
        .poll(async () => (await report(page)).rendered.maxProgress)
        .toBeGreaterThan(first.rendered.minProgress);
    await expect.poll(async () => (await report(page)).count).toBe(0);
    await expect(action).toBeDisabled();
    await expect(action).toBeEnabled({ timeout: 6000 });
    const previousKey = (await report(page)).rendered.key;
    await action.focus();
    await page.keyboard.press('Enter');
    await expect
        .poll(async () => (await report(page)).rendered?.key)
        .not.toBe(previousKey);
    await expect.poll(async () => (await report(page)).rendered?.peak).toBe(8);
    await expect(page.getByTestId('raking-garden')).toHaveText(original ?? '');
    expect(writes).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('combobox')).toHaveCount(0);
    await expect(
        page.getByRole('button', {
            name: 'Ukrasno jesensko lišće',
            exact: true,
        }),
    ).toBeFocused();
});

test('touch and reduced motion remain usable; drag, account/garden changes and target removal cancel activity', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mount(<LeafRakingFixture />);
    await ready(page);
    const action = page.getByRole('button', {
        name: 'Razgrni lišće',
        exact: true,
    });
    await action.tap();
    await expect(page.getByTestId('raking-state')).toContainText(
        '"reducedMotion":true',
    );
    await expect.poll(async () => (await report(page)).count).toBe(0);
    await expect(action).toBeEnabled({ timeout: 6000 });
    await page.getByRole('button', { name: 'Enter drag', exact: true }).click();
    await page
        .getByRole('button', { name: 'Ukrasno jesensko lišće', exact: true })
        .click();
    await expect(action).toBeDisabled();
    await page
        .getByRole('button', { name: 'Finish drag', exact: true })
        .click();
    await page
        .getByRole('button', { name: 'Ukrasno jesensko lišće', exact: true })
        .click();
    await expect(action).toBeEnabled();
    await action.tap();
    await page
        .getByRole('button', { name: 'Switch account', exact: true })
        .click();
    await expect(page.getByTestId('raking-state')).toContainText(
        '"action":null',
    );
    await page
        .getByRole('button', { name: 'Ukrasno jesensko lišće', exact: true })
        .click();
    await action.tap();
    await page
        .getByRole('button', { name: 'Switch garden', exact: true })
        .click();
    await expect(page.getByTestId('raking-state')).toContainText(
        '"action":null',
    );
    await page
        .getByRole('button', { name: 'Ukrasno jesensko lišće', exact: true })
        .click();
    await action.tap();
    await page
        .getByRole('button', { name: 'Remove targets', exact: true })
        .click();
    await expect(page.getByTestId('raking-state')).toContainText(
        '"action":null',
    );
    await expect(
        page.getByRole('button', {
            name: 'Ukrasno jesensko lišće',
            exact: true,
        }),
    ).toHaveCount(0);
});

test('frozen clocks release cooldown; sound respects mute and renderer unmount cancels all work', async ({
    mount,
    page,
}) => {
    await page.evaluate(() => {
        const metrics = { starts: 0, active: 0, peak: 0 };
        Reflect.set(window, '__rakingAudio', metrics);
        const original = AudioContext.prototype.createBufferSource;
        AudioContext.prototype.createBufferSource = function () {
            const source = original.call(this);
            const start = source.start.bind(source);
            source.start = (...args) => {
                if (source.buffer && source.buffer.duration < 0.3) {
                    metrics.starts += 1;
                    metrics.active += 1;
                    metrics.peak = Math.max(metrics.peak, metrics.active);
                    source.addEventListener(
                        'ended',
                        () => (metrics.active -= 1),
                    );
                }
                start(...args);
            };
            return source;
        };
    });
    const fixture = await mount(<LeafRakingFixture fixedTimeSeconds={8} />);
    await ready(page);
    const action = page.getByRole('button', {
        name: 'Razgrni lišće',
        exact: true,
    });
    await action.click();
    await expect(action).toBeEnabled({ timeout: 6000 });
    await page
        .getByRole('button', { name: 'Allow audio', exact: true })
        .click();
    await page
        .getByRole('button', { name: 'Ukrasno jesensko lišće', exact: true })
        .click();
    await page.getByRole('checkbox', { name: 'Šuškanje', exact: true }).check();
    await action.click();
    const audio = () =>
        page.evaluate(() => Reflect.get(window, '__rakingAudio'));
    await expect
        .poll(async () => (await audio()).starts, { timeout: 5000 })
        .toBeGreaterThan(0);
    await page
        .getByRole('button', { name: 'Mute master', exact: true })
        .click();
    await expect.poll(async () => (await audio()).active).toBe(0);
    await page
        .getByRole('button', { name: 'Ukrasno jesensko lišće', exact: true })
        .click();
    await expect(action).toBeEnabled({ timeout: 6000 });
    const starts = (await audio()).starts;
    await action.click();
    await expect(action).toBeEnabled({ timeout: 6000 });
    expect((await audio()).starts).toBe(starts);
    await page
        .getByRole('button', { name: 'Allow audio', exact: true })
        .click();
    await page
        .getByRole('button', { name: 'Mute ambient', exact: true })
        .click();
    await page
        .getByRole('button', { name: 'Ukrasno jesensko lišće', exact: true })
        .click();
    await action.click();
    await fixture.update(
        <LeafRakingFixture mounted={false} fixedTimeSeconds={8} />,
    );
    await expect(page.getByTestId('raking-state')).toContainText(
        '"available":false',
    );
    await expect(page.getByTestId('raking-state')).toContainText(
        '"action":null',
    );
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect.poll(async () => (await audio()).active).toBe(0);
    expect((await audio()).starts).toBe(starts);
    expect((await audio()).peak).toBeLessThanOrEqual(1);
});
