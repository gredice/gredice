import { expect, test } from '@playwright/experimental-ct-react';
import type { Locator, Page } from '@playwright/test';
import {
    ActiveItemsHudDropTargetStory,
    CloseupBottomHudStory,
    ControlsTooltipCloseupStory,
    HorseItemsHudStory,
    ItemsHudAlignmentStory,
    ItemsHudCameraTargetStory,
    ItemsHudControlsTooltipStory,
    ItemsHudDragStateStory,
    ItemsHudDropTargetStory,
    LocalSandboxItemsHudStory,
    LowSunflowerBalanceItemsHudDragStateStory,
    LowSunflowerBalanceItemsHudStory,
    SandboxItemsHudDropTargetStory,
    SandboxItemsHudStory,
} from './ItemsHudStory';

const TABLET_VIEWPORT = { width: 820, height: 1180 };
const SHORT_MOBILE_VIEWPORT = { width: 414, height: 420 };
const newBlockCatalogItems = [
    { label: 'Zec', price: 350, picker: 'Ljubimci' },
    { label: 'Kokošinjac', price: 500, picker: 'Ljubimci' },
    { label: 'Koza', price: 500, picker: 'Ljubimci' },
    { label: 'Konj', price: 500, picker: 'Ljubimci' },
    { label: 'Obor za praščića', price: 500, picker: 'Ljubimci' },
    { label: 'Bijela ograda', price: 5, picker: 'Ograde' },
    { label: 'Kamena ograda', price: 5, picker: 'Ograde' },
    { label: 'Ograda od poliranog kamena', price: 5, picker: 'Ograde' },
    { label: 'Vrata za drvenu ogradu', price: 8, picker: 'Ograde' },
    { label: 'Vrata za bijelu ogradu', price: 8, picker: 'Ograde' },
    { label: 'Vrata za kamenu ogradu', price: 8, picker: 'Ograde' },
    {
        label: 'Vrata za ogradu od poliranog kamena',
        price: 8,
        picker: 'Ograde',
    },
    { label: 'Kamena staza', price: 50, picker: 'Dekoracija' },
    { label: 'Ribarska barka', price: 150, picker: 'Dekoracija' },
    { label: 'Emajlirana vrtna lampa', price: 80, picker: 'Rasvjeta' },
    {
        label: 'Dvostruki drveni rasvjetni stup',
        price: 120,
        picker: 'Rasvjeta',
    },
    { label: 'Svjetleći luk od lijeske', price: 120, picker: 'Rasvjeta' },
    { label: 'Fenjer od starog crijepa', price: 40, picker: 'Rasvjeta' },
    { label: 'Pleteni vrtni fenjer', price: 60, picker: 'Rasvjeta' },
    { label: 'Drveni ručni fenjer', price: 50, picker: 'Rasvjeta' },
    { label: 'Mjesečeva bačva', price: 100, picker: 'Rasvjeta' },
] as const;

async function dragLocatorByMouse(page: Page, locator: Locator) {
    await locator.hover();
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

test('warms item thumbnails one menu level ahead while idle', async ({
    mount,
    page,
}) => {
    const imageRequests: string[] = [];
    page.on('request', (request) => {
        if (request.resourceType() === 'image') {
            imageRequests.push(request.url());
        }
    });

    await mount(<ItemsHudAlignmentStory />);

    await expect
        .poll(() => imageRequests.join('\n'))
        .toContain('WoodenBench.webp');

    await page.getByRole('button', { name: 'Dekoracija' }).click();

    await expect
        .poll(() => imageRequests.join('\n'))
        .toContain('LemonadeStand.webp');
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
    const toggle = page.getByTitle('Sakrij kontrole');
    await expect(picker).toBeVisible();
    await expect(guide).toBeVisible();
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByText('Pokupi / spusti')).toBeVisible();

    const pickerBox = await picker.boundingBox();
    const guideBox = await guide.boundingBox();
    expect(pickerBox).not.toBeNull();
    expect(guideBox).not.toBeNull();

    expect((guideBox?.y ?? 0) + (guideBox?.height ?? 0)).toBeLessThanOrEqual(
        (pickerBox?.y ?? 0) - 8,
    );

    const toggleBox = await toggle.boundingBox();
    expect(toggleBox).not.toBeNull();
    expect(guideBox?.x ?? 0).toBeLessThanOrEqual(toggleBox?.x ?? 0);
    expect((guideBox?.x ?? 0) + (guideBox?.width ?? 0)).toBeGreaterThanOrEqual(
        (toggleBox?.x ?? 0) + (toggleBox?.width ?? 0),
    );

    await toggle.click();
    await expect(guide).toHaveCount(0);
    await expect(page.getByTitle('Prikaži kontrole')).toHaveAttribute(
        'aria-expanded',
        'false',
    );
});

test('automatically opening controls instructions preserve focus', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(TABLET_VIEWPORT);
    await page.evaluate(() => {
        window.localStorage.setItem(
            'game-controls-tooltip-v1',
            JSON.stringify({
                tablet: { dismissedAt: Date.now(), seenVersion: 3 },
            }),
        );
    });
    await mount(<ItemsHudControlsTooltipStory />);

    const toggle = page.locator(
        'button[aria-controls="game-controls-tooltip"]',
    );
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('title', 'Prikaži kontrole');
    await toggle.focus();
    await expect(toggle).toBeFocused();

    await page.evaluate(() => {
        window.localStorage.removeItem('game-controls-tooltip-v1');
        window.dispatchEvent(new Event('resize'));
    });

    await expect(
        page.locator('[data-controls-tooltip-hud="open"]'),
    ).toBeVisible();
    await expect(toggle).toBeFocused();
});

test('controls instructions close when entering closeup view', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(TABLET_VIEWPORT);
    await page.evaluate(() => {
        window.localStorage.removeItem('game-controls-tooltip-v1');
    });
    await mount(<ControlsTooltipCloseupStory />);

    const guide = page.locator('[data-controls-tooltip-hud="open"]');
    await expect(guide).toBeVisible();

    await page.getByRole('button', { name: 'Uđi u gredicu' }).click();

    await expect(guide).toHaveCount(0);
    await expect(page.getByTitle('Prikaži kontrole')).toHaveAttribute(
        'aria-expanded',
        'false',
    );
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

test('sandbox item picker reveals a delete drop target during pickup', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(TABLET_VIEWPORT);
    await mount(<SandboxItemsHudDropTargetStory />);

    const picker = page.locator('[data-items-hud]');
    await expect(picker).toHaveAttribute('data-items-hud-drop-target', 'true');
    await expect(page.getByText('Obriši')).toBeVisible();
    await expect(
        page.locator('[data-sandbox-block-trash-drop-target="true"]'),
    ).toHaveCount(0);
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

test('decorations are grouped into summer, furniture, pets, and signs', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(TABLET_VIEWPORT);
    await mount(<ItemsHudAlignmentStory />);

    await page.getByRole('button', { name: 'Dekoracija' }).click();

    for (const label of ['Ljeto', 'Namještaj', 'Ljubimci', 'Znakovi']) {
        await expect(
            page.getByRole('button', { name: label, exact: true }),
        ).toBeVisible();
    }
    await expect(page.getByRole('button', { name: 'Putokazi' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'WoodenSign' })).toHaveCount(
        0,
    );

    await page.getByRole('button', { name: 'Ljeto' }).click();
    await expect(
        page.getByRole('button', { name: 'BeachUmbrella' }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'LemonadeStand' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Natrag' }).click();

    await page.getByRole('button', { name: 'Namještaj' }).click();
    await expect(
        page.getByRole('button', { name: 'WoodenBench' }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Drveni izložbeni stol' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Natrag' }).click();

    await page.getByRole('button', { name: 'Ljubimci' }).click();
    await expect(page.getByRole('button', { name: 'BirdHouse' })).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Kokošinjac' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Koza' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'DogHouse' })).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Konj', exact: true }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Obor za praščića' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Zec' })).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Chicken', exact: true }),
    ).toHaveCount(0);
    await expect(
        page.getByRole('button', { name: 'Piglet', exact: true }),
    ).toHaveCount(0);
    await expect(
        page.getByRole('button', { name: 'Frog', exact: true }),
    ).toHaveCount(0);
    await expect(
        page.getByRole('button', { name: 'Žaba', exact: true }),
    ).toHaveCount(0);
    await page.getByRole('button', { name: 'Natrag' }).click();

    await page.getByRole('button', { name: 'Znakovi' }).click();
    await expect(
        page.getByRole('button', { name: 'ArrowSignWhiteRight' }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'WoodenSign' }),
    ).toBeVisible();
});

test('terrain blocks are grouped by biome or material type', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(TABLET_VIEWPORT);
    await mount(<ItemsHudAlignmentStory />);

    await page.getByRole('button', { name: 'Blokovi' }).click();

    const groups = [
        ['Trava', 'Block Grass Angle'],
        ['Zemlja', 'Block Ground Corner'],
        ['Suha zemlja', 'Suha zemlja obrnuti kut'],
        ['Močvara', 'Močvarna voda'],
        ['Kamen', 'Kutne kamene stube'],
        ['Polirani kamen', 'Kutne polirane kamene stube'],
        ['Šljunak', 'Šljunak rub'],
        ['Pijesak', 'Block Sand Reverse Corner'],
        ['Snijeg', 'Block Snow Reverse Corner'],
        ['Voda', 'Block Water'],
    ];

    for (const [groupLabel, representativeItemLabel] of groups) {
        await expect(
            page.getByRole('button', { name: groupLabel, exact: true }),
        ).toBeVisible();
        await page
            .getByRole('button', { name: groupLabel, exact: true })
            .click();
        await expect(
            page.getByRole('button', {
                name: representativeItemLabel,
                exact: true,
            }),
        ).toBeVisible();
        await page.getByRole('button', { name: 'Natrag' }).click();
    }
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
        page.getByRole('button', { name: 'Mali drveni most' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Namještaj' }).click();
    await expect(
        page.getByRole('button', { name: 'Drveni izložbeni stol' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Natrag' }).click();
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

test('small wooden bridge uses the published shop price', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(TABLET_VIEWPORT);
    await mount(<ItemsHudAlignmentStory />);

    await page.getByRole('button', { name: 'Dekoracija' }).click();
    await page.getByRole('button', { name: 'Mali drveni most' }).click();
    await expect(
        page.getByRole('button', { name: /Postavi.*80/u }),
    ).toBeVisible();
});

test('stackable display table is offered at its catalog price', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(TABLET_VIEWPORT);
    await mount(<ItemsHudAlignmentStory />);

    await page.getByRole('button', { name: 'Dekoracija' }).click();
    await page.getByRole('button', { name: 'Namještaj' }).click();
    await page.getByRole('button', { name: 'Drveni izložbeni stol' }).click();
    await expect(
        page.getByRole('button', { name: /Postavi.*40/u }),
    ).toBeVisible();
});

test('garden lights are grouped under Rasvjeta', async ({ mount, page }) => {
    await page.setViewportSize(TABLET_VIEWPORT);
    await mount(<ItemsHudAlignmentStory />);

    await page.getByRole('button', { name: 'Dekoracija' }).click();
    await expect(
        page
            .locator('[data-items-picker-group-label]')
            .filter({ hasText: 'Rasvjeta' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Rasvjeta' }).click();

    for (const label of [
        'Staklenka s krijesnicom',
        'Emajlirana vrtna lampa',
        'Dvostruki drveni rasvjetni stup',
        'Svjetleći luk od lijeske',
        'Fenjer od starog crijepa',
        'Pleteni vrtni fenjer',
        'Drveni ručni fenjer',
        'Mjesečeva bačva',
    ]) {
        await expect(page.getByRole('button', { name: label })).toBeVisible();
    }
});

test('connected fences are grouped under Ograde', async ({ mount, page }) => {
    await page.setViewportSize(TABLET_VIEWPORT);
    await mount(<ItemsHudAlignmentStory />);

    await page.getByRole('button', { name: 'Dekoracija' }).click();
    await expect(
        page
            .locator('[data-items-picker-group-label]')
            .filter({ hasText: 'Ograde' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Ograde' }).click();

    await expect(
        page.getByRole('button', { name: 'Ograda', exact: true }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Bijela ograda' }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Kamena ograda' }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Ograda od poliranog kamena' }),
    ).toBeVisible();
    for (const label of [
        'Vrata za drvenu ogradu',
        'Vrata za bijelu ogradu',
        'Vrata za kamenu ogradu',
        'Vrata za ogradu od poliranog kamena',
    ]) {
        await expect(page.getByRole('button', { name: label })).toBeVisible();
    }
});

for (const item of newBlockCatalogItems) {
    test(`${item.label} uses the published shop price`, async ({
        mount,
        page,
    }) => {
        await page.setViewportSize(TABLET_VIEWPORT);
        await mount(<ItemsHudAlignmentStory />);

        await page.getByRole('button', { name: 'Dekoracija' }).click();
        if (item.picker !== 'Dekoracija') {
            await page.getByRole('button', { name: item.picker }).click();
        }
        await page.getByRole('button', { name: item.label }).click();
        await expect(
            page.getByRole('button', {
                name: new RegExp(`Postavi.*${item.price}`, 'u'),
            }),
        ).toBeVisible();
    });
}

test('local sandbox decoration picker includes current decoration blocks', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(TABLET_VIEWPORT);
    await mount(<LocalSandboxItemsHudStory />);

    await page.getByRole('button', { name: 'Dekoracija' }).click();

    await expect(page.getByRole('button', { name: 'Sunflower' })).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'SmallWoodenBridge' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Namještaj' }).click();
    await expect(
        page.getByRole('button', { name: 'Drveni izložbeni stol' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Natrag' }).click();
    await expect(
        page.getByRole('button', { name: 'WoodenWalkway' }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Kamena staza' }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Ribarska barka' }),
    ).toBeVisible();
    await expect(
        page
            .locator('[data-items-picker-group-label]')
            .filter({ hasText: 'Rasvjeta' }),
    ).toBeVisible();
    await expect(
        page
            .locator('[data-items-picker-group-label]')
            .filter({ hasText: 'Malč' }),
    ).toBeVisible();
    await expect(
        page
            .locator('[data-items-picker-group-label]')
            .filter({ hasText: 'Ograde' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Ljubimci' }).click();
    await expect(
        page.getByRole('button', { name: 'Kokošinjac' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Koza' })).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Konj', exact: true }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Obor za praščića' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Zec' })).toBeVisible();
    await page.getByRole('button', { name: 'Natrag' }).click();

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

test('raised-bed picker offers one complete 1 x 2 bed at the combined price', async ({
    mount,
    page,
}) => {
    await mount(<ItemsHudAlignmentStory />);

    await page.getByRole('button', { name: 'Gredica 1 × 2' }).click();

    const raisedBedButton = page.getByRole('button', {
        name: 'Raised Bed 1 × 2',
        exact: true,
    });
    await expect(raisedBedButton).toBeVisible();
    await raisedBedButton.click();

    await expect(page.getByText('Raised Bed 1 × 2')).toBeVisible();
    await expect(
        page.getByRole('button', { name: /Postavi.*20/u }),
    ).toBeEnabled();
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
    await page.getByRole('button', { name: 'Ograde' }).click();

    const fenceButton = page.getByRole('button', {
        name: 'Ograda',
        exact: true,
    });
    await dragLocatorByMouse(page, fenceButton);

    await expect(dragState).toHaveText('Fence:drag');
    await page.mouse.up();
    await expect(dragState).toHaveText('Fence:drop');
    await expect(
        page.getByText('Mock block for HUD layout tests.'),
    ).toHaveCount(0);
});

test('dragging a nested picker item hides and restores the same picker state on desktop', async ({
    mount,
    page,
}) => {
    await mount(<ItemsHudDragStateStory />);

    await page.getByRole('button', { name: 'Dekoracija' }).click();
    await page.getByRole('button', { name: 'Malč' }).click();

    const pickerContent = page.locator('[data-items-picker-content="true"]');
    await expect(pickerContent).toHaveAttribute(
        'data-active-items-picker',
        'Malč',
    );

    const mulchButton = page.getByRole('button', {
        name: 'Malč - kora drveta',
    });
    await expect(mulchButton).toBeVisible();

    await dragLocatorByMouse(page, mulchButton);

    await expect(page.getByTestId('hud-placement-drag-state')).toHaveText(
        'MulchWood:drag',
    );
    await expect(pickerContent).toHaveAttribute(
        'data-items-picker-drag-hidden',
        'true',
    );

    await page.mouse.up();

    await expect(page.getByTestId('hud-placement-drag-state')).toHaveText(
        'MulchWood:drop',
    );
    await expect(pickerContent).toHaveAttribute(
        'data-items-picker-drag-hidden',
        'false',
    );
    await expect(pickerContent).toHaveAttribute(
        'data-active-items-picker',
        'Malč',
    );
    await expect(mulchButton).toBeVisible();
    await expect(page.getByRole('button', { name: 'Posude' })).toHaveCount(0);
});

test('dismissing a nested picker keeps its content during the close animation', async ({
    mount,
    page,
}) => {
    await mount(<ItemsHudAlignmentStory />);

    await page.getByRole('button', { name: 'Dekoracija' }).click();
    await page.getByRole('button', { name: 'Malč' }).click();

    const pickerContent = page.locator('[data-items-picker-content="true"]');
    await expect(pickerContent).toHaveAttribute(
        'data-active-items-picker',
        'Malč',
    );

    await page.keyboard.press('Escape');

    await expect(pickerContent).toHaveAttribute(
        'data-active-items-picker',
        'Malč',
    );
    await expect(page.getByRole('button', { name: 'Posude' })).toHaveCount(0);

    await page.waitForTimeout(220);
    await expect(pickerContent).toHaveCount(0);

    await page.getByRole('button', { name: 'Dekoracija' }).click();
    await expect(
        page.locator('[data-items-picker-content="true"]'),
    ).toHaveAttribute('data-active-items-picker', 'Dekoracija');
});

test('touch drag cancellation clears HUD item placement', async ({
    mount,
    page,
}) => {
    await mount(<ItemsHudDragStateStory />);

    await page.getByRole('button', { name: 'Dekoracija' }).click();
    await page.getByRole('button', { name: 'Namještaj' }).click();

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
    await page.getByRole('button', { name: 'Namještaj' }).click();
    await page.getByRole('button', { name: 'Stool' }).click();

    const placeButton = page.getByRole('button', { name: /Postavi.*10/u });
    await expect(placeButton).toBeVisible();
    await expect(placeButton).toHaveClass(/bg-primary\/10/u);

    const pricePill = placeButton.locator('div').filter({ hasText: '10' });
    await expect(pricePill).toHaveClass(/bg-primary\/15/u);
});

test('horse placement requires and persists one explicit coat variant', async ({
    mount,
    page,
}) => {
    const placementBodies: unknown[] = [];
    await page.route(
        /\/api(?:\/gredice)?\/gardens\/1\/blocks$/u,
        async (route) => {
            placementBodies.push(route.request().postDataJSON());
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    id: 'placed-horse',
                    position: { x: 0, y: 0 },
                    variant: 4,
                }),
            });
        },
    );

    await mount(<HorseItemsHudStory />);
    await page.getByRole('button', { name: 'Dekoracija' }).click();
    await page.getByRole('button', { name: 'Ljubimci' }).click();
    await page.getByRole('button', { name: 'Konj', exact: true }).click();

    const coatPicker = page.getByRole('group', { name: 'Boja dlake' });
    await expect(coatPicker).toBeVisible();
    await expect(coatPicker.getByRole('radio')).toHaveCount(6);

    const placeButton = page.getByRole('button', { name: /Postavi.*500/u });
    await expect(placeButton).toBeDisabled();
    await expect(
        page.getByText('Odaberi boju dlake prije postavljanja.'),
    ).toBeVisible();

    await coatPicker.getByText('Palomino', { exact: true }).click();
    await expect(
        coatPicker.getByRole('radio', { name: 'Palomino' }),
    ).toBeChecked();
    await expect(placeButton).toBeEnabled();
    await placeButton.click();

    await expect.poll(() => placementBodies.length).toBe(1);
    expect(placementBodies[0]).toMatchObject({
        blockName: 'Horse',
        variant: 4,
    });
    await expect(coatPicker).toHaveCount(0);
});

test('horse drag placement is unavailable until a coat is selected and carries it', async ({
    mount,
    page,
}) => {
    await mount(<HorseItemsHudStory />);
    await page.getByRole('button', { name: 'Dekoracija' }).click();
    await page.getByRole('button', { name: 'Ljubimci' }).click();

    const horseButton = page.getByRole('button', {
        name: 'Konj',
        exact: true,
    });
    await dragLocatorByMouse(page, horseButton);
    await page.mouse.up();
    await expect(page.getByTestId('hud-placement-drag-state')).toHaveText(
        'idle',
    );

    await horseButton.click();
    await page.getByText('Sivac', { exact: true }).click();
    await expect(page.getByRole('radio', { name: 'Sivac' })).toBeChecked();
    await page.keyboard.press('Escape');
    await dragLocatorByMouse(page, horseButton);

    await expect(page.getByTestId('hud-placement-drag-state')).toHaveText(
        'Horse:drag:3',
    );
    await page.mouse.up();
    await expect(page.getByTestId('hud-placement-drag-state')).toHaveText(
        'Horse:drop:3',
    );
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
    await page.getByRole('button', { name: 'Namještaj' }).click();
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
    await page.getByRole('button', { name: 'Trava' }).click();
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
    await page.getByRole('button', { name: 'Trava' }).click();
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
