import { expect, test } from '@playwright/experimental-ct-react';
import type { Page } from '@playwright/test';
import {
    RaisedBedFieldDndDialogStory,
    RaisedBedFieldHudStory,
    RaisedBedFieldSuggestionsStory,
} from './RaisedBedFieldHudStory';
import {
    buildCartItem,
    buildOperation,
    type RaisedBedScenario,
    testSorts,
} from './raisedBedFieldHudScenarios';

const MOBILE_VIEWPORT = { width: 390, height: 844 };
const DESKTOP_VIEWPORT = { width: 1280, height: 800 };

function emptyScenario(): RaisedBedScenario {
    return { fields: [] };
}

function abandonedScenario(): RaisedBedScenario {
    return {
        fields: [],
        raisedBedAbandonReason: 'inactivity',
        raisedBedStatus: 'abandoned',
    };
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

function plantedGrowingWithRecommendedOperationsScenario(): RaisedBedScenario {
    return {
        ...plantedGrowingScenario(),
        operations: [
            buildOperation({
                id: 201,
                name: 'mock-hoeing',
                label: 'Okopavanje',
                stageName: 'maintenance',
                stageLabel: 'Održavanje',
                relativeDays: 1,
            }),
            buildOperation({
                id: 202,
                name: 'mock-weeding',
                label: 'Uklanjanje korova',
                stageName: 'maintenance',
                stageLabel: 'Održavanje',
                relativeDays: 2,
            }),
        ],
    };
}

function plantedGrowingWithOperationHistoryScenario(): RaisedBedScenario {
    const wateringOperation = buildOperation({
        id: 301,
        name: 'mock-history-watering',
        label: 'Zalijevanje',
        stageName: 'maintenance',
        stageLabel: 'Održavanje',
    });

    return {
        ...plantedGrowingScenario(),
        operations: [wateringOperation],
        operationHistoryItems: [
            {
                id: 901,
                entityId: wateringOperation.id,
                entityTypeName: 'operation',
                raisedBedId: 1,
                raisedBedFieldId: 1,
                status: 'completed',
                createdAt: '2026-05-10T00:00:00.000Z',
                scheduledDate: '2026-05-10T00:00:00.000Z',
                scheduledAt: '2026-05-09T00:00:00.000Z',
                completedAt: '2026-05-10T08:00:00.000Z',
                verifiedAt: '2026-05-10T09:00:00.000Z',
                canceledAt: null,
                imageUrls: ['https://example.com/watering.jpg'],
                completionNotes: 'Biljka je zalivena nakon pregleda tla.',
                targetLabel: 'Polje 1 • Raised Bed 1',
                statusHistory: [
                    {
                        status: 'new',
                        changedAt: '2026-05-09T00:00:00.000Z',
                    },
                    {
                        status: 'planned',
                        changedAt: '2026-05-09T00:00:00.000Z',
                    },
                    {
                        status: 'completed',
                        changedAt: '2026-05-10T09:00:00.000Z',
                    },
                ],
            },
            {
                id: 902,
                entityId: wateringOperation.id,
                entityTypeName: 'operation',
                raisedBedId: 1,
                raisedBedFieldId: 99,
                status: 'completed',
                createdAt: '2026-05-10T00:00:00.000Z',
                scheduledDate: null,
                scheduledAt: null,
                completedAt: '2026-05-10T08:00:00.000Z',
                verifiedAt: '2026-05-10T09:00:00.000Z',
                canceledAt: null,
                imageUrls: [],
                completionNotes: 'Ovo je zapis za drugo polje.',
                targetLabel: 'Polje 99 • Raised Bed 1',
                statusHistory: [
                    {
                        status: 'completed',
                        changedAt: '2026-05-10T09:00:00.000Z',
                    },
                ],
            },
        ],
    };
}

function plantedSownWithScheduledScenario(): RaisedBedScenario {
    return {
        fields: [
            {
                positionIndex: 0,
                plantSortId: testSorts.tomato.id,
                plantStatus: 'sprouted',
                plantScheduledDate: '2026-05-01T00:00:00.000Z',
                plantSowDate: '2026-05-01T00:00:00.000Z',
                plantGrowthDate: '2026-05-10T00:00:00.000Z',
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

function plantedWithFutureReadyDateScenario(): RaisedBedScenario {
    return {
        fields: [
            {
                positionIndex: 0,
                plantSortId: testSorts.tomato.id,
                plantStatus: 'ready',
                plantSowDate: daysAgoIso(60),
                plantGrowthDate: daysAgoIso(45),
                plantReadyDate: daysFromNowIso(140),
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

function daysFromNowIso(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() + days);
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

    test('opening a HUD dialog keeps drag sensors stable', async ({
        mount,
        page,
    }) => {
        const dragSensorErrors: string[] = [];
        page.on('console', (message) => {
            if (
                message.type() === 'error' &&
                message
                    .text()
                    .includes(
                        'The final argument passed to useEffect changed size between renders',
                    )
            ) {
                dragSensorErrors.push(message.text());
            }
        });

        await mount(<RaisedBedFieldDndDialogStory scenario={cartScenario()} />);
        await page.getByRole('button', { name: 'Toggle dialog' }).click();

        await expect(page.getByRole('dialog')).toBeVisible();
        await page.waitForTimeout(100);
        expect(dragSensorErrors).toEqual([]);
    });

    test('abandoned raised bed shows inactivity message instead of sowing grid', async ({
        mount,
        page,
    }) => {
        await mount(
            <RaisedBedFieldDndDialogStory scenario={abandonedScenario()} />,
        );

        await expect(
            page.getByText('Gredica je napuštena zbog neaktivnosti.'),
        ).toBeVisible();
        await expect(
            page.getByText(
                'Nove sjetve i radnje više nisu dostupne za ovu gredicu.',
            ),
        ).toBeVisible();
        await expect(page.getByRole('button')).toHaveCount(1);
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

    test('status popover allows reverting ready state back to sprouted', async ({
        mount,
        page,
    }) => {
        await mount(
            <RaisedBedFieldHudStory
                scenario={plantedReadyScenario()}
                positionIndex={0}
            />,
        );

        await page.getByRole('button').first().click();

        const dialog = page.getByRole('dialog');
        await dialog
            .getByRole('button', {
                name: 'Stanje biljke: Spremna za berbu',
            })
            .click();

        await expect(page.getByText('Promijeni stanje')).toBeVisible();
        await expect(page.getByText('Proklijala').last()).toBeVisible();
        await expect(
            page.getByRole('button', { name: 'Odaberi datum promjene' }),
        ).toBeVisible();
    });

    test('future harvest date shows absolute harvest days', async ({
        mount,
        page,
    }) => {
        await mount(
            <RaisedBedFieldHudStory
                scenario={plantedWithFutureReadyDateScenario()}
                positionIndex={0}
            />,
        );

        await page.getByRole('button').first().click();

        const dialog = page.getByRole('dialog');
        await expect(
            dialog.getByRole('button', { name: 'Berba: 140 dana' }),
        ).toBeVisible();
        await expect(dialog.getByText(/Berba:\s*-/)).toHaveCount(0);
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

    test('recommended operations list ends with all actions item', async ({
        mount,
        page,
    }) => {
        await mount(
            <RaisedBedFieldHudStory
                scenario={plantedGrowingWithRecommendedOperationsScenario()}
                positionIndex={0}
            />,
        );

        await page.getByRole('button').first().click();

        const dialog = page.getByRole('dialog');
        const recommendationsList = dialog.locator(
            '[data-recommended-operation-list]',
        );
        await expect(recommendationsList).toBeVisible();
        await expect(recommendationsList).toContainText('Okopavanje');
        await expect(recommendationsList).toContainText('Uklanjanje korova');

        const listItems = recommendationsList.locator(':scope > *');
        await expect(listItems).toHaveCount(3);
        await expect(listItems.last()).toContainText('Sve radnje...');
        const allActionsButton = recommendationsList.getByRole('button', {
            name: 'Sve radnje...',
        });
        await expect(allActionsButton).toBeVisible();
        await expect(
            dialog.getByRole('button', { name: 'Sve radnje', exact: true }),
        ).toHaveCount(0);

        await allActionsButton.click();

        await expect(
            dialog.getByRole('tab', { name: /Radnje/ }),
        ).toHaveAttribute('aria-selected', 'true');
    });

    test('diary tab shows filtered operation history with photos and notes', async ({
        mount,
        page,
    }) => {
        await mount(
            <RaisedBedFieldHudStory
                scenario={plantedGrowingWithOperationHistoryScenario()}
                positionIndex={0}
                enableRaisedBedImageAI
            />,
        );

        await page.getByRole('button').first().click();

        const dialog = page.getByRole('dialog');
        await dialog.getByRole('tab', { name: /Dnevnik/ }).click();

        await expect(dialog.getByText('Zalijevanje')).toBeVisible();
        await expect(
            dialog.getByText('Biljka je zalivena nakon pregleda tla.'),
        ).toBeVisible();
        await expect(dialog.locator('[data-operation-images]')).toBeVisible();
        await expect(
            dialog.getByRole('button', {
                name: /Pitaj suncokret za savjete/u,
            }),
        ).toBeVisible();
        await expect(
            dialog.getByText('Ovo je zapis za drugo polje.'),
        ).toHaveCount(0);
    });

    test('lifecycle modal opens status change popover from current state', async ({
        mount,
        page,
    }) => {
        await mount(
            <RaisedBedFieldHudStory
                scenario={plantedSownWithScheduledScenario()}
                positionIndex={0}
            />,
        );

        await page.getByRole('button').first().click();

        const dialog = page.getByRole('dialog');
        await expect(dialog.getByText('Planirani datum')).toHaveCount(0);

        const germinationDetailsButton = dialog.getByRole('button', {
            name: 'Klijanje: 9 dana',
        });
        await expect(germinationDetailsButton).toBeVisible();
        await expect(dialog.getByText('1.-10.5.2026.')).toHaveCount(0);
        await germinationDetailsButton.click();
        await expect(page.getByText('1.-10.5.2026.')).toBeVisible();
        await expect(
            page.getByText('Očekivano za ovu sortu: 5-10 dana'),
        ).toBeVisible();
        await expect(
            page.getByText(
                'Klijanje je razdoblje od sijanja do trenutka kada sjeme proklija',
            ),
        ).toBeVisible();
        const stageDetailsLink = page
            .getByRole('link', { name: 'Detalji o biljci' })
            .filter({ hasText: 'Detalji o biljci' });
        await expect(stageDetailsLink).toHaveAttribute(
            'href',
            'https://www.gredice.com/biljke/rajcica/sorte/cherry-rajcica',
        );

        await dialog
            .getByRole('button', {
                name: 'Promijeni stanje biljke: Proklijala',
            })
            .click();

        await expect(page.getByText('Promijeni stanje')).toBeVisible();
        await expect(
            page.getByRole('button', { name: 'Nije proklijala' }),
        ).toBeVisible();
        await expect(
            page.getByRole('button', { name: 'Neuspjela' }),
        ).toBeVisible();
        const readyButton = page.getByRole('button', {
            name: 'Spremna za berbu',
        });
        await expect(readyButton).toContainText('🥕');
        await expect(readyButton.locator('svg')).toBeVisible();

        const statusChangeDateButton = page.getByRole('button', {
            name: /Odaberi datum promjene: \d{2}\. \d{2}\. \d{4}\./,
        });
        await expect(statusChangeDateButton).toBeVisible();
        await statusChangeDateButton.click();

        await expect(
            page.getByRole('textbox', { name: 'Datum promjene' }),
        ).toBeVisible();
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

    test('quick sowing recommendations stay inside their card', async ({
        mount,
        page,
    }) => {
        await mount(
            <RaisedBedFieldSuggestionsStory scenario={emptyScenario()} />,
        );

        const recommendations = page.locator(
            '[data-quick-sowing-recommendations]',
        );
        await expect(recommendations).toBeVisible();

        const recommendationBox = await recommendations.boundingBox();
        expect(recommendationBox).not.toBeNull();

        const buttons = recommendations.locator('button');
        await expect(buttons).toHaveCount(2);

        await expect(buttons.first()).toHaveCSS(
            'background-image',
            /linear-gradient/u,
        );
        await expect(buttons.nth(1)).toHaveCSS(
            'background-image',
            /linear-gradient/u,
        );

        for (let index = 0; index < 2; index += 1) {
            const buttonBox = await buttons.nth(index).boundingBox();
            expect(buttonBox).not.toBeNull();
            expect(buttonBox?.x).toBeGreaterThanOrEqual(
                recommendationBox?.x ?? 0,
            );
            expect(
                (buttonBox?.x ?? 0) + (buttonBox?.width ?? 0),
            ).toBeLessThanOrEqual(
                (recommendationBox?.x ?? 0) + (recommendationBox?.width ?? 0),
            );
        }
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
        await historyButton.dispatchEvent('click', {
            bubbles: true,
            cancelable: true,
        });

        await expect(stack).toHaveAttribute('data-touch-expanded', 'true');
        await expect(page.getByRole('dialog')).toHaveCount(0);

        await historyButton.dispatchEvent('pointerdown', {
            bubbles: true,
            cancelable: true,
            pointerType: 'touch',
        });
        await historyButton.dispatchEvent('click', {
            bubbles: true,
            cancelable: true,
        });

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
        const stack = page.locator('[data-field-icon-stack]');
        const historyButtons = page.getByRole('button', {
            name: /Povijest biljke /,
        });
        await expect(historyButtons).toHaveCount(2);
        const historyButton = historyButtons.last();
        await historyButton.dispatchEvent('pointerdown', {
            bubbles: true,
            cancelable: true,
            pointerType: 'touch',
        });
        await historyButton.dispatchEvent('click', {
            bubbles: true,
            cancelable: true,
        });
        await expect(stack).toHaveAttribute('data-touch-expanded', 'true');
        await historyButton.dispatchEvent('pointerdown', {
            bubbles: true,
            cancelable: true,
            pointerType: 'touch',
        });
        await historyButton.dispatchEvent('click', {
            bubbles: true,
            cancelable: true,
        });

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
