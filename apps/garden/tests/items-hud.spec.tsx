import { expect, test } from '@playwright/experimental-ct-react';
import {
    ItemsHudAlignmentStory,
    ItemsHudControlsTooltipStory,
    LowSunflowerBalanceItemsHudStory,
    SandboxBlockTrashDropTargetStory,
    SandboxItemsHudStory,
} from './ItemsHudStory';

const TABLET_VIEWPORT = { width: 820, height: 1180 };
const SHORT_MOBILE_VIEWPORT = { width: 414, height: 420 };

function getPlacementRequestPosition(body: unknown) {
    if (typeof body !== 'object' || body === null || !('position' in body)) {
        return null;
    }

    const { position } = body;
    if (
        typeof position !== 'object' ||
        position === null ||
        !('x' in position) ||
        !('y' in position) ||
        typeof position.x !== 'number' ||
        typeof position.y !== 'number'
    ) {
        return null;
    }

    return {
        x: position.x,
        y: position.y,
    };
}

test('item picker stays centered on tablet layouts', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(TABLET_VIEWPORT);
    await mount(<ItemsHudAlignmentStory />);

    const picker = page.locator('[data-items-hud]');
    await expect(picker).toBeVisible();

    const pickerBox = await picker.boundingBox();
    expect(pickerBox).not.toBeNull();

    const pickerCenter = (pickerBox?.x ?? 0) + (pickerBox?.width ?? 0) / 2;
    expect(
        Math.abs(pickerCenter - TABLET_VIEWPORT.width / 2),
    ).toBeLessThanOrEqual(1);
    expect((pickerBox?.x ?? 0) + (pickerBox?.width ?? 0)).toBeLessThanOrEqual(
        TABLET_VIEWPORT.width,
    );
});

test('item picker floats above the bottom edge without a border', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(SHORT_MOBILE_VIEWPORT);
    await mount(<ItemsHudAlignmentStory />);

    const picker = page.locator('[data-items-hud]');
    await expect(picker).toBeVisible();
    await page.waitForTimeout(350);

    const pickerBox = await picker.boundingBox();
    expect(pickerBox).not.toBeNull();

    const bottomGap =
        SHORT_MOBILE_VIEWPORT.height -
        ((pickerBox?.y ?? 0) + (pickerBox?.height ?? 0));
    expect(Math.round(bottomGap)).toBeGreaterThanOrEqual(4);

    const surfaceStyle = await picker.evaluate((node) => {
        const style = window.getComputedStyle(node);
        return {
            borderWidths: [
                style.borderTopWidth,
                style.borderRightWidth,
                style.borderBottomWidth,
                style.borderLeftWidth,
            ],
            boxShadow: style.boxShadow,
        };
    });

    expect(surfaceStyle.borderWidths).toEqual(['0px', '0px', '0px', '0px']);
    expect(surfaceStyle.boxShadow).not.toBe('none');
});

test('bottom helper controls are left aligned', async ({ mount, page }) => {
    await page.setViewportSize(SHORT_MOBILE_VIEWPORT);
    await mount(<ItemsHudAlignmentStory />);

    const controls = page.getByTestId('bottom-controls');
    await expect(controls).toBeVisible();

    const controlsBox = await controls.boundingBox();
    expect(controlsBox).not.toBeNull();
    expect(Math.round(controlsBox?.x ?? 0)).toBe(0);
});

test('controls instructions clear the item picker on tablet layouts', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(TABLET_VIEWPORT);
    await mount(<ItemsHudControlsTooltipStory />);

    const picker = page.locator('[data-items-hud]');
    const guide = page.locator('[data-controls-tooltip-hud="open"]');
    await expect(picker).toBeVisible();
    await expect(guide).toBeVisible();
    await expect(page.getByText('Pokupi / spusti')).toBeVisible();

    const pickerBox = await picker.boundingBox();
    const guideBox = await guide.boundingBox();
    expect(pickerBox).not.toBeNull();
    expect(guideBox).not.toBeNull();

    expect((guideBox?.y ?? 0) + (guideBox?.height ?? 0)).toBeLessThanOrEqual(
        (pickerBox?.y ?? 0) - 8,
    );
});

test('sandbox trash target appears centered above item picker while dragging', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(TABLET_VIEWPORT);
    await mount(<SandboxBlockTrashDropTargetStory />);

    const picker = page.locator('[data-items-hud]');
    const trashTarget = page.locator(
        '[data-sandbox-block-trash-drop-target="true"]',
    );
    await expect(picker).toBeVisible();
    await expect(trashTarget).toBeVisible();

    const pickerBox = await picker.boundingBox();
    const trashBox = await trashTarget.boundingBox();
    expect(pickerBox).not.toBeNull();
    expect(trashBox).not.toBeNull();

    const trashCenter = (trashBox?.x ?? 0) + (trashBox?.width ?? 0) / 2;
    expect(
        Math.abs(trashCenter - TABLET_VIEWPORT.width / 2),
    ).toBeLessThanOrEqual(1);
    expect((trashBox?.y ?? 0) + (trashBox?.height ?? 0)).toBeLessThanOrEqual(
        (pickerBox?.y ?? 0) - 8,
    );
    await expect(trashTarget).toHaveClass(/bg-red-600/u);
});

test('pots are listed under the decoration picker', async ({ mount, page }) => {
    await page.setViewportSize(TABLET_VIEWPORT);
    await mount(<ItemsHudAlignmentStory />);

    await expect(page.getByRole('button', { name: 'Posude' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Dekoracija' }).click();

    await expect(
        page
            .locator('[data-items-picker-group-label]')
            .filter({ hasText: 'Posude' }),
    ).toBeVisible();
    await expect(
        page
            .locator('[data-items-picker-group-label]')
            .filter({ hasText: 'Kamenje' }),
    ).toBeVisible();
    await expect(
        page
            .locator('[data-items-picker-group-label]')
            .filter({ hasText: 'Malč' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Posude' }).click();

    await expect(
        page.getByRole('button', { name: 'PotLowBowl' }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'PotWideLippedCup' }),
    ).toBeVisible();
});

test('tool picker lists functional garden boxes outside sandbox', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(TABLET_VIEWPORT);
    await mount(<ItemsHudAlignmentStory />);

    await page.getByRole('button', { name: 'Alat' }).click();
    await expect(page.getByRole('button', { name: 'GardenBox' })).toBeVisible();
});

test('sandbox tool picker hides nonfunctional garden boxes', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(TABLET_VIEWPORT);
    await mount(<SandboxItemsHudStory />);

    await page.getByRole('button', { name: 'Alat' }).click();
    await expect(page.getByRole('button', { name: 'GardenBox' })).toHaveCount(
        0,
    );
    await expect(page.getByRole('button', { name: 'Bucket' })).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'WateringCan' }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'ShovelSmall' }),
    ).toBeVisible();
});

test('sandbox decoration picker includes special blocks', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(TABLET_VIEWPORT);
    await mount(<SandboxItemsHudStory />);

    await page.getByRole('button', { name: 'Dekoracija' }).click();

    await expect(page.getByRole('button', { name: 'Besplatno' })).toHaveCount(
        0,
    );
    await expect(page.getByRole('button', { name: '🌻 0' })).not.toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Snowman' })).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'GiftBox RedWhite' }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'PineAdvent' }),
    ).toBeVisible();

    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Blokovi' }).click();

    await expect(
        page.getByRole('button', { name: 'Block Snow Falling' }),
    ).toBeVisible();
});

test('item picker price buttons use the soft surface', async ({
    mount,
    page,
}) => {
    await mount(<ItemsHudAlignmentStory />);

    await page.getByRole('button', { name: 'Dekoracija' }).click();

    const priceButton = page
        .locator('button')
        .filter({ hasText: '10' })
        .first();
    await expect(priceButton).toBeVisible();
    await expect(priceButton).toHaveClass(/bg-primary\/10/u);
});

test('item picker disables purchase buttons above the sunflower balance', async ({
    mount,
    page,
}) => {
    await mount(<ItemsHudAlignmentStory />);

    await page.getByRole('button', { name: 'Alat' }).click();

    const affordablePriceButton = page
        .getByRole('button', { name: /10/u })
        .first();
    await expect(affordablePriceButton).toBeEnabled();

    const expensivePriceButton = page.getByRole('button', { name: /100/u });
    await expect(expensivePriceButton).toBeVisible();
    await expect(expensivePriceButton).toBeDisabled();

    await page.getByRole('button', { name: 'PaintRoller' }).click();

    const detailsPlaceButton = page.getByRole('button', {
        name: /Postavi.*100/u,
    });
    await expect(detailsPlaceButton).toBeDisabled();
    await expect(page.getByText('Nedovoljno suncokreta.')).toBeVisible();
});

test('item details place button keeps the soft color treatment', async ({
    mount,
    page,
}) => {
    await mount(<ItemsHudAlignmentStory />);

    await page.getByRole('button', { name: 'Dekoracija' }).click();
    await page.getByRole('button', { name: 'Stool' }).click();

    const placeButton = page.getByRole('button', { name: /Postavi.*10/u });
    await expect(placeButton).toBeVisible();
    await expect(placeButton).toHaveClass(/bg-primary\/10/u);

    const pricePill = placeButton.locator('div').filter({ hasText: '10' });
    await expect(pricePill).toHaveClass(/bg-primary\/15/u);
});

test('item placement reserves local positions while requests are pending', async ({
    mount,
    page,
}) => {
    const placeRequestPositions: Array<{ x: number; y: number }> = [];
    const releaseResponses: Array<() => void> = [];

    await page.route(
        /\/api(?:\/gredice)?\/gardens\/1\/blocks$/u,
        async (route) => {
            const position = getPlacementRequestPosition(
                route.request().postDataJSON(),
            );
            if (position) {
                placeRequestPositions.push(position);
            }
            const blockId = `placed-block-${placeRequestPositions.length.toString()}`;

            await new Promise<void>((resolve) => {
                releaseResponses.push(resolve);
            });

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    id: blockId,
                    position: { x: 0, y: 0 },
                }),
            });
        },
    );

    await mount(<ItemsHudAlignmentStory />);

    await page.getByRole('button', { name: 'Blokovi' }).click();
    await page
        .getByRole('button', { name: 'Block Grass', exact: true })
        .click();

    const placeButton = page.getByRole('button', { name: /Postavi.*10/u });
    await expect(placeButton).toBeEnabled();

    await placeButton.dblclick();
    await expect.poll(() => placeRequestPositions.length).toBe(2);
    await expect(placeButton).toBeEnabled();
    expect(placeRequestPositions[0]).not.toEqual(placeRequestPositions[1]);

    for (const releaseResponse of releaseResponses) {
        releaseResponse();
    }
});

test('item placement subtracts pending sunflower spends before enabling more purchases', async ({
    mount,
    page,
}) => {
    const placeRequestPositions: Array<{ x: number; y: number }> = [];
    const releaseResponses: Array<() => void> = [];

    await page.route(
        /\/api(?:\/gredice)?\/gardens\/1\/blocks$/u,
        async (route) => {
            const position = getPlacementRequestPosition(
                route.request().postDataJSON(),
            );
            if (position) {
                placeRequestPositions.push(position);
            }
            const blockId = `placed-block-${placeRequestPositions.length.toString()}`;

            await new Promise<void>((resolve) => {
                releaseResponses.push(resolve);
            });

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    id: blockId,
                    position: { x: 0, y: 0 },
                }),
            });
        },
    );

    await mount(<LowSunflowerBalanceItemsHudStory />);

    await page.getByRole('button', { name: 'Blokovi' }).click();
    await page
        .getByRole('button', { name: 'Block Grass', exact: true })
        .click();

    const placeButton = page.getByRole('button', { name: /Postavi.*10/u });
    await expect(placeButton).toBeEnabled();

    await placeButton.dblclick();
    await expect.poll(() => placeRequestPositions.length).toBe(2);
    await expect(placeButton).toBeDisabled();

    for (const releaseResponse of releaseResponses) {
        releaseResponse();
    }
});

test('decoration picker scrolls when the viewport is too short for all items', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(SHORT_MOBILE_VIEWPORT);
    await mount(<ItemsHudAlignmentStory />);

    await page.getByRole('button', { name: 'Dekoracija' }).click();

    const firstItem = page.getByRole('button', { name: 'Posude' });
    const lastItem = page.getByRole('button', { name: 'CactusPricklyPear' });

    await expect(firstItem).toBeVisible();

    const scrollArea = page.locator('[data-items-picker-scroll]');
    const popoverBox = await scrollArea.boundingBox();
    expect(popoverBox).not.toBeNull();
    expect(
        (popoverBox?.y ?? 0) + (popoverBox?.height ?? 0),
    ).toBeLessThanOrEqual(SHORT_MOBILE_VIEWPORT.height + 1);

    const scrollState = await scrollArea.evaluate((node) => ({
        scrollHeight: node.scrollHeight,
        clientHeight: node.clientHeight,
    }));
    expect(scrollState.scrollHeight).toBeGreaterThan(scrollState.clientHeight);

    await expect(lastItem).not.toBeInViewport();
    await lastItem.scrollIntoViewIfNeeded();
    await expect(lastItem).toBeInViewport();
});
