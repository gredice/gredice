import { expect, test } from '@playwright/experimental-ct-react';
import type { Locator } from '@playwright/test';
import { RaisedBedDiaryOverflowStory } from './RaisedBedDiaryStory';

const MOBILE_VIEWPORT = { width: 390, height: 844 };
const TABLET_VIEWPORT = { width: 1024, height: 768 };

async function expectNoHorizontalOverflow(locator: Locator) {
    const overflow = await locator.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
    }));

    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

test('raised bed diary entries stay inside a narrow mobile card', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await mount(<RaisedBedDiaryOverflowStory />);

    const shell = page.getByTestId('diary-shell');
    const list = page.locator('[data-diary-list]');
    const entries = page.locator('[data-diary-entry]');

    await expect(list).toBeVisible();
    await expect(entries).toHaveCount(3);

    await expectNoHorizontalOverflow(shell);
    await expectNoHorizontalOverflow(list);

    const overflowingEntries = await entries.evaluateAll((elements) =>
        elements
            .map((element, index) => ({
                clientWidth: element.clientWidth,
                index,
                scrollWidth: element.scrollWidth,
            }))
            .filter(
                ({ clientWidth, scrollWidth }) => scrollWidth > clientWidth + 1,
            ),
    );

    expect(overflowingEntries).toEqual([]);
});

test('single-image diary entries keep text close to the thumbnail', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(TABLET_VIEWPORT);
    await mount(<RaisedBedDiaryOverflowStory />);

    const firstEntry = page.locator('[data-diary-entry]').first();
    const imageBox = await firstEntry
        .locator('[data-diary-entry-images]')
        .boundingBox();
    const contentBox = await firstEntry
        .locator('[data-diary-entry-content]')
        .boundingBox();

    expect(imageBox).not.toBeNull();
    expect(contentBox).not.toBeNull();

    const imageRight = (imageBox?.x ?? 0) + (imageBox?.width ?? 0);
    const textGap = (contentBox?.x ?? 0) - imageRight;

    expect(textGap).toBeLessThanOrEqual(24);
});
