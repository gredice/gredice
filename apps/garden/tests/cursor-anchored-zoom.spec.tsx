import { expect, test } from '@playwright/experimental-ct-react';
import { CursorAnchoredZoomFixture } from '../../../packages/game/tests/CursorAnchoredZoomFixture';

test('keeps the world position beneath the cursor fixed while wheel zooming', async ({
    mount,
    page,
}) => {
    const fixture = await mount(<CursorAnchoredZoomFixture />);
    const probe = fixture.getByTestId('camera-projection');
    await expect(probe).toHaveAttribute('data-ready', 'true');

    const anchorBefore = {
        x: Number(await probe.getAttribute('data-anchor-x')),
        y: Number(await probe.getAttribute('data-anchor-y')),
    };
    const zoomBefore = Number(await probe.getAttribute('data-zoom'));

    await page.mouse.move(anchorBefore.x, anchorBefore.y);
    await page.mouse.wheel(0, -400);

    await expect
        .poll(async () => Number(await probe.getAttribute('data-zoom')))
        .toBeGreaterThan(zoomBefore);

    const anchorAfter = {
        x: Number(await probe.getAttribute('data-anchor-x')),
        y: Number(await probe.getAttribute('data-anchor-y')),
    };
    const targetAfter = await probe.getAttribute('data-target');

    expect(Math.abs(anchorAfter.x - anchorBefore.x)).toBeLessThan(0.51);
    expect(Math.abs(anchorAfter.y - anchorBefore.y)).toBeLessThan(0.51);
    expect(targetAfter).not.toBe('[0,0,0]');
});
