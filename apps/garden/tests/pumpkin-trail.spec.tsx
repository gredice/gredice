import { writeFile } from 'node:fs/promises';
import { expect as baseExpect, test } from '@playwright/experimental-ct-react';
import type { Locator } from '@playwright/test';
import { PumpkinTrailFixture } from '../../../packages/game/tests/PumpkinTrailFixture';

test.setTimeout(120_000);
test.use({ hasTouch: true });
const expect = baseExpect.configure({ timeout: 60000 });
async function report(fixture: Locator) {
    return JSON.parse((await fixture.getAttribute('data-report')) || '{}');
}
async function litCount(fixture: Locator) {
    return (await report(fixture)).lanterns?.filter(
        (l: { emissive: number }) => l.emissive > 0.2,
    ).length;
}
test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
        const u = new URL(route.request().url());
        return ['localhost', '127.0.0.1'].includes(u.hostname) &&
            ['GET', 'HEAD'].includes(route.request().method())
            ? route.continue()
            : route.abort();
    });
});
test('keyboard start, any-order repeats, actual partial/completed lights and fresh reset without writes', async ({
    mount,
    page,
}) => {
    const requests: string[] = [];
    page.on('request', (r) => requests.push(r.url()));
    const fixture = await mount(<PumpkinTrailFixture />);
    await expect.poll(() => litCount(fixture)).toBe(0);
    const data = await report(fixture);
    const canvasBounds = await page.locator('canvas').boundingBox();
    if (!canvasBounds) throw new Error('Canvas absent');
    await page.mouse.click(
        canvasBounds.x + data.lanterns[0].screen.x,
        canvasBounds.y + data.lanterns[0].screen.y,
    );
    await expect.poll(() => litCount(fixture)).toBe(0);
    await expect(page.locator('[data-public-garden-sound]')).toHaveAttribute(
        'data-public-garden-sound',
        'disabled',
    );
    expect(data.markers).toBe(5);
    expect(data.pixels).toBeGreaterThan(1);
    expect(data.bounds.minX).toBeGreaterThan(0);
    expect(data.bounds.maxX).toBeLessThan(data.width);
    expect(data.bounds.minY).toBeGreaterThan(0);
    expect(data.bounds.maxY).toBeLessThan(data.height);
    await expect(
        page.getByRole('button', { name: 'Bundeva 1', exact: true }),
    ).toBeDisabled();
    await page.getByRole('button', { name: 'Započni stazu' }).focus();
    await page.keyboard.press('Enter');
    await expect(
        page.getByRole('button', { name: 'Bundeva 1', exact: true }),
    ).toBeFocused();
    await page.keyboard.press('Space');
    await page.mouse.click(
        canvasBounds.x + data.lanterns[3].screen.x,
        canvasBounds.y + data.lanterns[3].screen.y,
    );
    await expect.poll(() => litCount(fixture)).toBe(2);
    await page.mouse.click(
        canvasBounds.x + data.lanterns[3].screen.x,
        canvasBounds.y + data.lanterns[3].screen.y,
    );
    await page.mouse.click(
        canvasBounds.x + canvasBounds.width / 2,
        canvasBounds.y + canvasBounds.height / 2,
    );
    await expect.poll(() => litCount(fixture)).toBe(2);
    expect((await report(fixture)).camera).toEqual(data.camera);
    await expect(page.locator('[data-pumpkin-trail-status]')).toHaveText(
        'Upaljeno 2 od 5 bundeva.',
    );
    await page
        .locator('[data-pumpkin-trail-scene]')
        .screenshot({ path: '/tmp/gredice-pumpkin-trail-partial.png' });
    for (const n of [5, 3, 2])
        await page
            .getByRole('button', { name: `Bundeva ${n}`, exact: true })
            .click();
    await expect.poll(() => litCount(fixture)).toBe(5);
    expect(
        (await report(fixture)).lanterns.reduce(
            (n: number, l: { light: number }) => n + l.light,
            0,
        ),
    ).toBe(5);
    await expect(page.locator('[data-pumpkin-trail-status]')).toContainText(
        'Staza je osvijetljena',
    );
    await page
        .locator('[data-pumpkin-trail-scene]')
        .screenshot({ path: '/tmp/gredice-pumpkin-trail-completed.png' });
    await page.getByRole('button', { name: 'Kreni ispočetka' }).click();
    await expect.poll(() => litCount(fixture)).toBe(0);
    await expect(
        page.getByRole('button', { name: 'Započni stazu' }),
    ).toBeFocused();
    await expect(page.locator('[data-pumpkin-trail-status]')).toContainText(
        'prvi korak',
    );
    expect(
        requests.filter((u) =>
            /auth\/|accounts\/|gardens\/|presence|directories|weather/.test(u),
        ),
    ).toEqual([]);
    await fixture.unmount();
    await expect(page.locator('canvas')).toHaveCount(0);
});
test('mobile reduced-motion touch: all faces emissive under four-light budget, phase changes retain state and remount clears it', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const fixture = await mount(<PumpkinTrailFixture />);
    await expect.poll(() => litCount(fixture)).toBe(0);
    await page.getByRole('button', { name: 'Započni stazu' }).tap();
    const before = await report(fixture);
    const canvas = await page.locator('canvas').boundingBox();
    if (!canvas) throw new Error('Canvas absent');
    await page.touchscreen.tap(
        canvas.x + before.lanterns[1].screen.x,
        canvas.y + before.lanterns[1].screen.y,
    );
    await expect.poll(() => litCount(fixture)).toBe(1);
    await page.touchscreen.tap(
        canvas.x + before.lanterns[1].screen.x,
        canvas.y + before.lanterns[1].screen.y,
    );
    await expect.poll(() => litCount(fixture)).toBe(1);
    for (const n of [5, 1, 4, 3])
        await page
            .getByRole('button', { name: `Bundeva ${n}`, exact: true })
            .tap();
    await expect.poll(() => litCount(fixture)).toBe(5);
    const data = await report(fixture);
    expect(data.camera).toEqual(before.camera);
    expect(
        data.lanterns.reduce(
            (n: number, l: { light: number }) => n + l.light,
            0,
        ),
    ).toBe(4);
    expect(data.pixels).toBeGreaterThan(1);
    expect(data.bounds.minX).toBeGreaterThan(0);
    expect(data.bounds.maxX).toBeLessThan(data.width);
    expect(data.bounds.minY).toBeGreaterThan(0);
    expect(data.bounds.maxY).toBeLessThan(data.height);
    await page
        .locator('[data-pumpkin-trail-scene]')
        .screenshot({ path: '/tmp/gredice-pumpkin-trail-mobile.png' });
    await page.screenshot({
        path: '/tmp/gredice-pumpkin-trail-mobile-page.png',
        fullPage: true,
    });
    await writeFile(
        '/tmp/gredice-pumpkin-trail-mobile-lights.json',
        JSON.stringify(data, null, 2),
    );
    await page.getByRole('button', { name: 'Dan', exact: true }).click();
    await expect.poll(() => litCount(fixture)).toBe(5);
    await page.getByRole('button', { name: 'Noć', exact: true }).click();
    await expect.poll(() => litCount(fixture)).toBe(5);
    await page.evaluate(() => {
        window.dispatchEvent(new PageTransitionEvent('pagehide'));
        window.dispatchEvent(new PageTransitionEvent('pageshow'));
    });
    await expect.poll(() => litCount(fixture)).toBe(0);
    await fixture.unmount();
    const fresh = await mount(<PumpkinTrailFixture />);
    await expect.poll(() => litCount(fresh)).toBe(0);
});
test('same IDs outside scoped trail retain ordinary night/day lantern behavior', async ({
    mount,
}) => {
    const fixture = await mount(<PumpkinTrailFixture ordinaryPhase="night" />);
    await expect.poll(() => litCount(fixture)).toBe(5);
    expect(
        (await report(fixture)).lanterns.reduce(
            (n: number, l: { light: number }) => n + l.light,
            0,
        ),
    ).toBe(4);
    await fixture.update(<PumpkinTrailFixture ordinaryPhase="day" />);
    await expect.poll(() => litCount(fixture)).toBe(0);
});
