import { expect, type Page, test } from '@playwright/experimental-ct-react';
import { RaisedBedFieldHudStory } from './RaisedBedFieldHudStory';
import {
    buildCartItem,
    type RaisedBedScenario,
    testSorts,
} from './raisedBedFieldHudScenarios';

const MOBILE_VIEWPORT = { width: 390, height: 844 };
const DESKTOP_VIEWPORT = { width: 1280, height: 800 };

function emptyScenario(): RaisedBedScenario {
    return { fields: [] };
}

function cartScenario(): RaisedBedScenario {
    return {
        fields: [],
        cartItems: [
            buildCartItem({
                id: 11,
                sort: testSorts.tomato,
                positionIndex: 0,
                scheduledDate: '2026-05-20T00:00:00.000Z',
            }),
        ],
    };
}

function plantedGrowingScenario(): RaisedBedScenario {
    return {
        fields: [
            {
                positionIndex: 0,
                plantSortId: testSorts.tomato.id,
                plantStatus: 'sprouted',
                plantSowDate: daysAgoIso(40),
                plantGrowthDate: daysAgoIso(30),
            },
        ],
    };
}

function plantedReadyScenario(): RaisedBedScenario {
    return {
        fields: [
            {
                positionIndex: 0,
                plantSortId: testSorts.tomato.id,
                plantStatus: 'ready',
                plantSowDate: daysAgoIso(60),
                plantGrowthDate: daysAgoIso(45),
                plantReadyDate: daysAgoIso(2),
            },
        ],
    };
}

function plantedHarvestedScenario(): RaisedBedScenario {
    return {
        fields: [
            {
                positionIndex: 0,
                plantSortId: testSorts.tomato.id,
                plantStatus: 'ready',
                plantSowDate: daysAgoIso(80),
                plantGrowthDate: daysAgoIso(70),
                plantReadyDate: daysAgoIso(20),
                plantHarvestedDate: daysAgoIso(5),
            },
        ],
    };
}

function plantedWithHistoryScenario(historyCount = 2): RaisedBedScenario {
    const history = Array.from({ length: historyCount }).map((_, index) => ({
        positionIndex: 0,
        plantSortId:
            index % 2 === 0 ? testSorts.basil.id : testSorts.lettuce.id,
        plantStatus: 'ready' as const,
        plantSowDate: daysAgoIso(200 - index * 30),
        plantGrowthDate: daysAgoIso(190 - index * 30),
        plantReadyDate: daysAgoIso(170 - index * 30),
        plantHarvestedDate: daysAgoIso(150 - index * 30),
        active: false,
    }));
    return {
        fields: [
            ...history,
            {
                positionIndex: 0,
                plantSortId: testSorts.tomato.id,
                plantStatus: 'ready',
                plantSowDate: daysAgoIso(60),
                plantGrowthDate: daysAgoIso(45),
                plantReadyDate: daysAgoIso(2),
            },
        ],
    };
}

function emptyWithHistoryScenario(historyCount = 2): RaisedBedScenario {
    const history = Array.from({ length: historyCount }).map((_, index) => ({
        positionIndex: 0,
        plantSortId:
            index % 2 === 0 ? testSorts.basil.id : testSorts.lettuce.id,
        plantStatus: 'ready' as const,
        plantSowDate: daysAgoIso(200 - index * 30),
        plantGrowthDate: daysAgoIso(190 - index * 30),
        plantReadyDate: daysAgoIso(170 - index * 30),
        plantHarvestedDate: daysAgoIso(150 - index * 30),
        active: false,
    }));
    return { fields: history };
}

function daysAgoIso(days: number): string {
    const date = new Date('2026-05-13T12:00:00.000Z');
    date.setDate(date.getDate() - days);
    return date.toISOString();
}

test.describe('RaisedBedFieldItem HUD (desktop)', () => {
    test.use({ viewport: DESKTOP_VIEWPORT });

    test('empty field shows sowing seed icon and no indicator stack', async ({
        mount,
        page,
    }) => {
        await mount(
            <RaisedBedFieldHudStory
                scenario={emptyScenario()}
                positionIndex={0}
            />,
        );

        await expect(page.getByRole('button').first()).toBeVisible();
        await expect(page.locator('[data-field-icon-stack]')).toHaveCount(0);
    });

    test('cart item shows cart indicator and scheduled date badge', async ({
        mount,
        page,
    }) => {
        await mount(
            <RaisedBedFieldHudStory
                scenario={cartScenario()}
                positionIndex={0}
            />,
        );

        const cartButton = page.getByRole('button', {
            name: 'Otvori sadnju u košarici',
        });
        await expect(cartButton).toBeVisible();
        const stack = page.locator('[data-field-icon-stack]');
        await expect(stack).toHaveCount(1);
        await expect(stack).toHaveAttribute('data-touch-expanded', 'false');
        const fieldButton = page.getByRole('button').first();
        await expect(fieldButton).toContainText('20');
    });

    test('planted growing field renders lifecycle progress and no indicator stack', async ({
        mount,
        page,
    }) => {
        await mount(
            <RaisedBedFieldHudStory
                scenario={plantedGrowingScenario()}
                positionIndex={0}
            />,
        );

        await expect(page.locator('svg circle').first()).toBeVisible();
        await expect(page.locator('[data-field-icon-stack]')).toHaveCount(0);
    });

    test('ready-to-harvest field shows the sprout status badge', async ({
        mount,
        page,
    }) => {
        await mount(
            <RaisedBedFieldHudStory
                scenario={plantedReadyScenario()}
                positionIndex={0}
            />,
        );

        const stack = page.locator('[data-field-icon-stack]');
        await expect(stack).toBeVisible();
        await expect(
            stack.locator('span.bg-blue-600 svg.lucide-sprout'),
        ).toBeVisible();
    });

    test('harvested field shows check indicator', async ({ mount, page }) => {
        await mount(
            <RaisedBedFieldHudStory
                scenario={plantedHarvestedScenario()}
                positionIndex={0}
            />,
        );

        const stack = page.locator('[data-field-icon-stack]');
        await expect(stack).toBeVisible();
        await expect(
            stack.locator('span.bg-green-600 svg.lucide-check'),
        ).toBeVisible();
    });

    test('empty field with 2 historical plants stacks avatar indicators', async ({
        mount,
        page,
    }) => {
        await mount(
            <RaisedBedFieldHudStory
                scenario={emptyWithHistoryScenario(2)}
                positionIndex={0}
            />,
        );

        const stack = page.locator('[data-field-icon-stack]');
        await expect(stack).toBeVisible();
        const avatars = page.getByRole('button', {
            name: /Povijest biljke /,
        });
        await expect(avatars).toHaveCount(2);
        await expect(
            page.getByRole('button', {
                name: 'Prikaži povijest biljaka za polje 1',
            }),
        ).toHaveCount(0);
    });

    test('empty field with 4 historical plants collapses extras into history modal trigger', async ({
        mount,
        page,
    }) => {
        await mount(
            <RaisedBedFieldHudStory
                scenario={emptyWithHistoryScenario(4)}
                positionIndex={0}
            />,
        );

        const stack = page.locator('[data-field-icon-stack]');
        await expect(stack).toBeVisible();
        await expect(
            page.getByRole('button', {
                name: /Povijest biljke /,
            }),
        ).toHaveCount(2);
        await expect(
            page.getByRole('button', {
                name: 'Prikaži povijest biljaka za polje 1',
            }),
        ).toBeVisible();
    });

    test('planted field with history stacks status badge with historical avatars', async ({
        mount,
        page,
    }) => {
        await mount(
            <RaisedBedFieldHudStory
                scenario={plantedWithHistoryScenario(2)}
                positionIndex={0}
            />,
        );

        const stack = page.locator('[data-field-icon-stack]');
        await expect(stack).toBeVisible();
        await expect(
            stack.locator('span.bg-blue-600 svg.lucide-sprout'),
        ).toBeVisible();
        await expect(
            page.getByRole('button', { name: /Povijest biljke / }),
        ).toHaveCount(2);
    });

    test('clicking planted field opens lifecycle modal on desktop', async ({
        mount,
        page,
    }) => {
        await mount(
            <RaisedBedFieldHudStory
                scenario={plantedGrowingScenario()}
                positionIndex={0}
            />,
        );

        await page.getByRole('button').first().click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        await expect(
            dialog.getByRole('heading', { name: /Biljka "Cherry rajčica"/ }),
        ).toBeVisible();
        await expect(dialog.getByRole('tab', { name: /Biljka/ })).toBeVisible();
        await expect(
            dialog.getByRole('tab', { name: /Dnevnik/ }),
        ).toBeVisible();
        await expect(dialog.getByRole('tab', { name: /Radnje/ })).toBeVisible();
    });

    test('opening the plant history modal lists prior plants newest first', async ({
        mount,
        page,
    }) => {
        await mount(
            <RaisedBedFieldHudStory
                scenario={emptyWithHistoryScenario(4)}
                positionIndex={0}
            />,
        );

        // Icons in the stack visually overlap until hover spreads them out, so
        // hover the stack first to make the MoreHorizontal trigger clickable
        // without being intercepted by sibling icons stacked on top of it.
        await page.locator('[data-field-icon-stack]').hover();
        await page
            .getByRole('button', {
                name: 'Prikaži povijest biljaka za polje 1',
            })
            .click();

        await expect(
            page.getByRole('heading', { name: 'Povijest polja' }),
        ).toBeVisible();
        const entries = page.getByRole('button', {
            name: /Otvori detalje biljke /,
        });
        await expect(entries).toHaveCount(4);
    });
});

test.describe('RaisedBedFieldItem HUD (mobile)', () => {
    test.use({
        viewport: MOBILE_VIEWPORT,
        hasTouch: true,
        isMobile: true,
    });

    test('cart item still renders cart indicator on mobile', async ({
        mount,
        page,
    }) => {
        await mount(
            <RaisedBedFieldHudStory
                scenario={cartScenario()}
                positionIndex={0}
            />,
        );

        await expect(
            page.getByRole('button', { name: 'Otvori sadnju u košarici' }),
        ).toBeVisible();
        await expect(page.locator('[data-field-icon-stack]')).toHaveAttribute(
            'data-touch-expanded',
            'false',
        );
    });

    test('first touch on a multi-icon stack expands instead of activating the icon', async ({
        mount,
        page,
    }) => {
        await mount(
            <RaisedBedFieldHudStory
                scenario={plantedWithHistoryScenario(2)}
                positionIndex={0}
            />,
        );

        const stack = page.locator('[data-field-icon-stack]');
        await expect(stack).toHaveAttribute('data-touch-expanded', 'false');

        const historyButton = page
            .getByRole('button', { name: /Povijest biljke / })
            .last();
        await historyButton.dispatchEvent('pointerdown', {
            bubbles: true,
            cancelable: true,
            pointerType: 'touch',
        });
        await historyButton.click({ force: true });

        await expect(stack).toHaveAttribute('data-touch-expanded', 'true');
        await expect(page.getByRole('dialog')).toHaveCount(0);

        await historyButton.dispatchEvent('pointerdown', {
            bubbles: true,
            cancelable: true,
            pointerType: 'touch',
        });
        await historyButton.click({ force: true });

        await expect(page.getByRole('dialog')).toBeVisible();
    });

    test('planted field opens as a bottom drawer with a drag handle', async ({
        mount,
        page,
    }) => {
        await mount(
            <RaisedBedFieldHudStory
                scenario={plantedGrowingScenario()}
                positionIndex={0}
            />,
        );

        await page.getByRole('button').first().click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        await expect(dialog).toHaveAttribute('data-vaul-drawer', '');
        await expect(dialog).toHaveAttribute(
            'data-vaul-drawer-direction',
            'bottom',
        );
        await expect(
            dialog.locator(
                'div.bg-muted.mx-auto.h-2.w-\\[100px\\].rounded-full',
            ),
        ).toHaveCount(1);
    });

    test('mobile drawer dismisses via swipe down on the drag handle', async ({
        mount,
        page,
    }) => {
        await mount(
            <RaisedBedFieldHudStory
                scenario={plantedGrowingScenario()}
                positionIndex={0}
            />,
        );

        await page.getByRole('button').first().click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        // Wait for the vaul slide-in animation to complete before measuring.
        await page.waitForTimeout(700);
        const dialogBox = await dialog.boundingBox();
        if (!dialogBox) {
            throw new Error('Expected drawer to have a bounding box.');
        }

        const startX = dialogBox.x + dialogBox.width / 2;
        const startY = dialogBox.y + 16;
        const endY = MOBILE_VIEWPORT.height + 200;

        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move(startX, startY + 80, { steps: 5 });
        await page.mouse.move(startX, startY + 240, { steps: 5 });
        await page.mouse.move(startX, endY, { steps: 5 });
        await page.mouse.up();

        await expect(page.getByRole('dialog')).toBeHidden();
    });

    test('mobile drawer can also be dismissed with the inline close button', async ({
        mount,
        page,
    }) => {
        await mount(
            <RaisedBedFieldHudStory
                scenario={plantedGrowingScenario()}
                positionIndex={0}
            />,
        );

        await page.getByRole('button').first().click();
        await expect(page.getByRole('dialog')).toBeVisible();

        await page.getByRole('button', { name: 'Zatvori' }).click();

        await expect(page.getByRole('dialog')).toBeHidden();
    });

    async function openHistoryAvatarDrawer(page: Page) {
        const historyButton = page
            .getByRole('button', { name: /Povijest biljke / })
            .last();
        await historyButton.dispatchEvent('pointerdown', {
            bubbles: true,
            cancelable: true,
            pointerType: 'touch',
        });
        await historyButton.click({ force: true });
        await historyButton.dispatchEvent('pointerdown', {
            bubbles: true,
            cancelable: true,
            pointerType: 'touch',
        });
        await historyButton.click({ force: true });

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        await expect(dialog).toHaveAttribute('data-vaul-drawer', '');
        // Let vaul's slide-in animation settle so layout measurements are
        // taken against the resting position rather than mid-transform values.
        await page.waitForTimeout(700);
        return dialog;
    }

    test('history avatar drawer dismisses via swipe down on the drag handle', async ({
        mount,
        page,
    }) => {
        await mount(
            <RaisedBedFieldHudStory
                scenario={emptyWithHistoryScenario(2)}
                positionIndex={0}
            />,
        );

        const dialog = await openHistoryAvatarDrawer(page);

        const dialogBox = await dialog.boundingBox();
        if (!dialogBox) {
            throw new Error('Expected history drawer to have a bounding box.');
        }

        const startX = dialogBox.x + dialogBox.width / 2;
        const startY = dialogBox.y + 16;
        const endY = MOBILE_VIEWPORT.height + 200;

        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move(startX, startY + 80, { steps: 5 });
        await page.mouse.move(startX, startY + 240, { steps: 5 });
        await page.mouse.move(startX, endY, { steps: 5 });
        await page.mouse.up();

        await expect(dialog).toBeHidden();
    });

    test('history avatar drawer dismisses by tapping the backdrop', async ({
        mount,
        page,
    }) => {
        await mount(
            <RaisedBedFieldHudStory
                scenario={emptyWithHistoryScenario(2)}
                positionIndex={0}
            />,
        );

        const dialog = await openHistoryAvatarDrawer(page);
        const dialogBox = await dialog.boundingBox();
        if (!dialogBox) {
            throw new Error('Expected history drawer to have a bounding box.');
        }

        const tapX = MOBILE_VIEWPORT.width / 2;
        const tapY = Math.max(20, dialogBox.y - 40);
        await page.mouse.click(tapX, tapY);

        await expect(dialog).toBeHidden();
    });

    async function openPlantDetailsFromAllHistoryModal(page: Page) {
        const stack = page.locator('[data-field-icon-stack]');
        const allHistoryButton = page.getByRole('button', {
            name: 'Prikaži povijest biljaka za polje 1',
        });

        // First tap expands the icon stack on mobile.
        await allHistoryButton.dispatchEvent('pointerdown', {
            bubbles: true,
            cancelable: true,
            pointerType: 'touch',
        });
        await allHistoryButton.dispatchEvent('click', { bubbles: true });
        await expect(stack).toHaveAttribute('data-touch-expanded', 'true');

        // Second tap actually opens the "Povijest polja" list drawer. Use
        // dispatchEvent so we hit the trigger element directly instead of
        // relying on position-based click while CSS transitions are running.
        await allHistoryButton.dispatchEvent('pointerdown', {
            bubbles: true,
            cancelable: true,
            pointerType: 'touch',
        });
        await allHistoryButton.dispatchEvent('click', { bubbles: true });

        const historyListDrawer = page.getByRole('dialog', {
            name: 'Povijest polja',
        });
        await expect(historyListDrawer).toBeVisible();
        // Allow the slide-in animation to settle before sampling layout.
        await page.waitForTimeout(700);

        await historyListDrawer
            .getByRole('button', { name: /Otvori detalje biljke / })
            .first()
            .click();

        const detailsDrawer = page
            .getByRole('dialog')
            .filter({ hasText: /Prethodna biljka/ });
        await expect(detailsDrawer).toBeVisible();
        await expect(detailsDrawer).toHaveAttribute('data-vaul-drawer', '');
        await page.waitForTimeout(700);
        return { detailsDrawer, historyListDrawer };
    }

    test('[regression] plant details opened from all-history list drawer dismisses via swipe down', async ({
        mount,
        page,
    }) => {
        await mount(
            <RaisedBedFieldHudStory
                scenario={emptyWithHistoryScenario(4)}
                positionIndex={0}
            />,
        );

        const { detailsDrawer } =
            await openPlantDetailsFromAllHistoryModal(page);

        const dialogBox = await detailsDrawer.boundingBox();
        if (!dialogBox) {
            throw new Error('Expected details drawer to have a bounding box.');
        }

        const startX = dialogBox.x + dialogBox.width / 2;
        const startY = dialogBox.y + 16;
        const endY = MOBILE_VIEWPORT.height + 200;

        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move(startX, startY + 80, { steps: 5 });
        await page.mouse.move(startX, startY + 240, { steps: 5 });
        await page.mouse.move(startX, endY, { steps: 5 });
        await page.mouse.up();

        await expect(detailsDrawer).toBeHidden();
    });

    test('[regression] plant details opened from all-history list drawer dismisses via backdrop tap', async ({
        mount,
        page,
    }) => {
        await mount(
            <RaisedBedFieldHudStory
                scenario={emptyWithHistoryScenario(4)}
                positionIndex={0}
            />,
        );

        const { detailsDrawer } =
            await openPlantDetailsFromAllHistoryModal(page);

        const dialogBox = await detailsDrawer.boundingBox();
        if (!dialogBox) {
            throw new Error('Expected details drawer to have a bounding box.');
        }
        const tapX = MOBILE_VIEWPORT.width / 2;
        const tapY = Math.max(20, dialogBox.y - 40);
        await page.mouse.click(tapX, tapY);

        await expect(detailsDrawer).toBeHidden();
    });

    test('[regression] history avatar drawer opened from a planted field dismisses via swipe down', async ({
        mount,
        page,
    }) => {
        await mount(
            <RaisedBedFieldHudStory
                scenario={plantedWithHistoryScenario(2)}
                positionIndex={0}
            />,
        );

        const dialog = await openHistoryAvatarDrawer(page);
        const dialogBox = await dialog.boundingBox();
        if (!dialogBox) {
            throw new Error('Expected history drawer to have a bounding box.');
        }

        const startX = dialogBox.x + dialogBox.width / 2;
        const startY = dialogBox.y + 16;
        const endY = MOBILE_VIEWPORT.height + 200;

        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move(startX, startY + 80, { steps: 5 });
        await page.mouse.move(startX, startY + 240, { steps: 5 });
        await page.mouse.move(startX, endY, { steps: 5 });
        await page.mouse.up();

        await expect(dialog).toBeHidden();
    });

    test('[regression] history avatar drawer opened from a planted field dismisses via backdrop tap', async ({
        mount,
        page,
    }) => {
        await mount(
            <RaisedBedFieldHudStory
                scenario={plantedWithHistoryScenario(2)}
                positionIndex={0}
            />,
        );

        const dialog = await openHistoryAvatarDrawer(page);
        const dialogBox = await dialog.boundingBox();
        if (!dialogBox) {
            throw new Error('Expected history drawer to have a bounding box.');
        }

        const tapX = MOBILE_VIEWPORT.width / 2;
        const tapY = Math.max(20, dialogBox.y - 40);
        await page.mouse.click(tapX, tapY);

        await expect(dialog).toBeHidden();
    });

    // Reproductions for the production bug where dismissal silently failed on
    // real touch input because the icon stack's capture-phase handlers fired
    // for events on the drawer overlay (which lives in a portal but is still a
    // React-tree descendant of the fieldset). Use real `touchscreen.tap` here
    // because the bug only manifests with `pointerType === 'touch'`.
    test('[regression] backdrop tap with real touch dismisses a stacked-plant drawer', async ({
        mount,
        page,
    }) => {
        await mount(
            <RaisedBedFieldHudStory
                scenario={emptyWithHistoryScenario(2)}
                positionIndex={0}
            />,
        );

        const historyButton = page
            .getByRole('button', { name: /Povijest biljke / })
            .last();
        // First tap expands the stack, second tap activates the avatar.
        await historyButton.tap();
        await historyButton.tap();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        // Wait for vaul's slide-in animation to settle before sampling layout.
        await page.waitForTimeout(700);

        const dialogBox = await dialog.boundingBox();
        if (!dialogBox) {
            throw new Error('Expected history drawer to have a bounding box.');
        }
        const tapX = dialogBox.x + dialogBox.width / 2;
        const tapY = Math.max(20, dialogBox.y - 50);
        await page.touchscreen.tap(tapX, tapY);

        await expect(dialog).toBeHidden();
    });

    test('[regression] swipe-down with real touch dismisses a stacked-plant drawer', async ({
        mount,
        page,
    }) => {
        await mount(
            <RaisedBedFieldHudStory
                scenario={emptyWithHistoryScenario(2)}
                positionIndex={0}
            />,
        );

        const historyButton = page
            .getByRole('button', { name: /Povijest biljke / })
            .last();
        await historyButton.tap();
        await historyButton.tap();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        await page.waitForTimeout(700);

        const dialogBox = await dialog.boundingBox();
        if (!dialogBox) {
            throw new Error('Expected history drawer to have a bounding box.');
        }

        // Swipe via CDP touch events so we exercise the real-touch dismissal
        // path that the bug hides behind.
        const cdp = await page.context().newCDPSession(page);
        const startX = dialogBox.x + dialogBox.width / 2;
        const startY = dialogBox.y + 16;
        const endY = MOBILE_VIEWPORT.height + 200;
        await cdp.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x: startX, y: startY }],
        });
        const steps = 10;
        for (let i = 1; i <= steps; i += 1) {
            await cdp.send('Input.dispatchTouchEvent', {
                type: 'touchMove',
                touchPoints: [
                    { x: startX, y: startY + ((endY - startY) * i) / steps },
                ],
            });
        }
        await cdp.send('Input.dispatchTouchEvent', {
            type: 'touchEnd',
            touchPoints: [],
        });
        await cdp.detach();

        await expect(dialog).toBeHidden();
    });
});
