import { expect, test } from '@playwright/experimental-ct-react';
import type { Locator, Page } from '@playwright/test';
import {
    ActiveItemsHudDropTargetStory,
    CloseupBottomHudStory,
    ItemsHudAlignmentStory,
    ItemsHudCameraTargetStory,
    ItemsHudControlsTooltipStory,
    ItemsHudDragStateStory,
    ItemsHudDropTargetStory,
    LocalSandboxItemsHudStory,
    LowSunflowerBalanceItemsHudDragStateStory,
    LowSunflowerBalanceItemsHudStory,
    SandboxBlockTrashDropTargetStory,
    SandboxItemsHudStory,
} from './ItemsHudStory';

const TABLET_VIEWPORT = { width: 820, height: 1180 };
const SHORT_MOBILE_VIEWPORT = { width: 414, height: 420 };

async function dragLocatorByMouse(page: Page, locator: Locator) {
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();

    const x = (box?.x ?? 0) + (box?.width ?? 0) / 2;
    const y = (box?.y ?? 0) + (box?.height ?? 0) / 2;

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y - 96, { steps: 6 });
    return { x, y: y - 96 };
}

async function dispatchTouchDrag({
    endEvent,
    locator,
    page,
}: {
    endEvent: 'pointercancel' | 'pointerup';
    locator: Locator;
    page: Page;
}) {
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();

    const x = (box?.x ?? 0) + (box?.width ?? 0) / 2;
    const y = (box?.y ?? 0) + (box?.height ?? 0) / 2;
    const pointerId = 41;

    await locator.dispatchEvent('pointerdown', {
        bubbles: true,
        button: 0,
        buttons: 1,
        clientX: x,
        clientY: y,
        isPrimary: true,
        pointerId,
        pointerType: 'touch',
    });
    await page.locator('body').dispatchEvent('pointermove', {
        bubbles: true,
        button: 0,
        buttons: 1,
        clientX: x,
        clientY: y - 96,
        isPrimary: true,
        pointerId,
        pointerType: 'touch',
    });
    await page.locator('body').dispatchEvent(endEvent, {
        bubbles: true,
        button: 0,
        buttons: endEvent === 'pointerup' ? 0 : 1,
        clientX: x,
        clientY: y - 96,
        isPrimary: true,
        pointerId,
        pointerType: 'touch',
    });
}

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

test('bottom hud slides out and disables controls in closeup view', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(SHORT_MOBILE_VIEWPORT);
    await mount(<CloseupBottomHudStory />);

    const controls = page.getByTestId('bottom-controls');
    const items = page.getByTestId('bottom-items');

    await expect(controls).toHaveAttribute('aria-hidden', 'true');
    await expect(items).toHaveAttribute('aria-hidden', 'true');
    await expect(controls).toHaveCSS('opacity', '0');
    await expect(items).toHaveCSS('opacity', '0');
    await expect(controls).toHaveCSS('pointer-events', 'none');
    await expect(items).toHaveCSS('pointer-events', 'none');

    await expect
        .poll(async () => {
            const boxes = await Promise.all([
                controls.boundingBox(),
                items.boundingBox(),
            ]);
            return boxes.every(
                (box) => box !== null && box.y >= SHORT_MOBILE_VIEWPORT.height,
            );
        })
        .toBe(true);
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

test('item picker does not show the recycle drop target while idle', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(TABLET_VIEWPORT);
    await mount(<ItemsHudAlignmentStory />);

    await expect(
        page.locator('[data-items-hud-drop-target="true"]'),
    ).toHaveCount(0);
});

test('item picker reveals a recycle drop target during pickup', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(TABLET_VIEWPORT);
    await mount(<ItemsHudDropTargetStory />);

    const picker = page.locator('[data-items-hud]');
    await expect(picker).toHaveAttribute('data-items-hud-drop-target', 'true');
    await expect(picker).toHaveAttribute(
        'data-items-hud-drop-target-active',
        'false',
    );
    await expect(page.getByText('Recikliranje')).toBeVisible();
});

test('item picker highlights while the picked block is over the drop target', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(TABLET_VIEWPORT);
    await mount(<ActiveItemsHudDropTargetStory />);

    const picker = page.locator('[data-items-hud]');
    await expect(picker).toHaveAttribute('data-items-hud-drop-target', 'true');
    await expect(picker).toHaveAttribute(
        'data-items-hud-drop-target-active',
        'true',
    );
    await expect(picker).toHaveClass(/border-red-500/u);
});

test('pots and mulch are listed under the decoration picker', async ({
    mount,
    page,
}) => {
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

    await page.getByRole('button', { name: 'Natrag' }).click();
    await page.getByRole('button', { name: 'Malč' }).click();

    await expect(
        page.getByRole('button', { name: 'Malč - kora drveta' }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Malč - kokosova kora' }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Malč - slama' }),
    ).toBeVisible();

    await expect(
        page.getByRole('img', { name: 'Malč - kora drveta' }).first(),
    ).toHaveAttribute('src', /MulchWood\.webp/u);

    await page.getByRole('button', { name: 'Malč - kora drveta' }).click();

    await expect(
        page.getByText(
            'Malč od kore drveta koristi se za zadržavanje vlage, zaštitu tla i smanjenje rasta korova.',
        ),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: /Postavi.*20/u }),
    ).toBeVisible();
});

test('trees are listed under the decoration tree picker', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(TABLET_VIEWPORT);
    await mount(<ItemsHudAlignmentStory />);

    await expect(page.getByRole('button', { name: 'Drveće' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Dekoracija' }).click();

    await expect(
        page
            .locator('[data-items-picker-group-label]')
            .filter({ hasText: 'Drveće' }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Tree', exact: true }),
    ).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'PalmTree' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Drveće' }).click();

    await expect(
        page.getByRole('button', { name: 'Tree', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pine' })).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'DeadTreeTall' }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'DeadTreeStump' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'PalmTree' })).toBeVisible();
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
        page
            .locator('[data-items-picker-group-label]')
            .filter({ hasText: 'Poklon kutije' }),
    ).toBeVisible();
    await expect(
        page
            .locator('[data-items-picker-group-label]')
            .filter({ hasText: 'Drveće' }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'GiftBox RedWhite' }),
    ).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'PineAdvent' })).toHaveCount(
        0,
    );

    await page.getByRole('button', { name: 'Poklon kutije' }).click();

    await expect(
        page.getByRole('button', { name: 'GiftBox RedWhite' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Natrag' }).click();
    await page.getByRole('button', { name: 'Drveće' }).click();

    await expect(
        page.getByRole('button', { name: 'PineAdvent' }),
    ).toBeVisible();

    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Blokovi' }).click();

    await expect(
        page.getByRole('button', { name: 'Block Snow Falling' }),
    ).toBeVisible();
});

test('local sandbox decoration picker includes sunflower and mulch', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(TABLET_VIEWPORT);
    await mount(<LocalSandboxItemsHudStory />);

    await page.getByRole('button', { name: 'Dekoracija' }).click();

    await expect(page.getByRole('button', { name: 'Sunflower' })).toBeVisible();
    await expect(
        page
            .locator('[data-items-picker-group-label]')
            .filter({ hasText: 'Malč' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Malč' }).click();

    await expect(page.getByRole('button', { name: 'MulchWood' })).toBeVisible();
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

test('dragging an affordable picker item requests a scene drop without opening details', async ({
    mount,
    page,
}) => {
    await mount(<ItemsHudDragStateStory />);

    const dragState = page.getByTestId('hud-placement-drag-state');
    await expect(dragState).toHaveText('idle');

    await page.getByRole('button', { name: 'Dekoracija' }).click();

    const stoolButton = page.getByRole('button', { name: 'Stool' });
    await dragLocatorByMouse(page, stoolButton);

    await expect(dragState).toHaveText('Stool:drag');
    await page.mouse.up();
    await expect(dragState).toHaveText('Stool:drop');
    await expect(
        page.getByText('Mock block for HUD layout tests.'),
    ).toHaveCount(0);
});

test('touch drag cancellation clears HUD item placement', async ({
    mount,
    page,
}) => {
    await mount(<ItemsHudDragStateStory />);

    await page.getByRole('button', { name: 'Dekoracija' }).click();

    const stoolButton = page.getByRole('button', { name: 'Stool' });
    await dispatchTouchDrag({
        endEvent: 'pointercancel',
        locator: stoolButton,
        page,
    });

    await expect(page.getByTestId('hud-placement-drag-state')).toHaveText(
        'idle',
    );
});

test('unaffordable item icons do not start HUD drag placement', async ({
    mount,
    page,
}) => {
    await mount(<LowSunflowerBalanceItemsHudDragStateStory />);

    await page.getByRole('button', { name: 'Alat' }).click();

    const paintRollerButton = page.getByRole('button', {
        name: 'PaintRoller',
    });
    await dragLocatorByMouse(page, paintRollerButton);
    await page.mouse.up();

    await expect(page.getByTestId('hud-placement-drag-state')).toHaveText(
        'idle',
    );
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

test('item placement starts near the current camera target', async ({
    mount,
    page,
}) => {
    const placeRequestPositions: Array<{ x: number; y: number }> = [];

    await page.route(
        /\/api(?:\/gredice)?\/gardens\/1\/blocks$/u,
        async (route) => {
            const position = getPlacementRequestPosition(
                route.request().postDataJSON(),
            );
            if (position) {
                placeRequestPositions.push(position);
            }

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    id: 'placed-block-1',
                    position: { x: 12, y: -8 },
                }),
            });
        },
    );

    await mount(<ItemsHudCameraTargetStory />);

    await page.getByRole('button', { name: 'Dekoracija' }).click();
    await page.getByRole('button', { name: 'Stool' }).click();
    await page.getByRole('button', { name: /Postavi.*10/u }).click();

    await expect.poll(() => placeRequestPositions.length).toBe(1);
    expect(placeRequestPositions).toEqual([{ x: 12, y: -8 }]);
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
