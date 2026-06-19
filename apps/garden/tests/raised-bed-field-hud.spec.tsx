import type {
    FavoriteEntityType,
    FavoriteItem,
    PlantData,
} from '@gredice/client';
import { expect, test } from '@playwright/experimental-ct-react';
import type { Page } from '@playwright/test';
import {
    RaisedBedCloseupHudStory,
    RaisedBedFieldDndDialogStory,
    RaisedBedFieldHudStory,
    RaisedBedFieldSuggestionsStory,
    RaisedBedInfoModalStory,
} from './RaisedBedFieldHudStory';
import {
    buildCartItem,
    buildOperation,
    type RaisedBedScenario,
    testSorts,
} from './raisedBedFieldHudScenarios';

const MOBILE_VIEWPORT = { width: 390, height: 844 };
const DESKTOP_VIEWPORT = { width: 1280, height: 800 };
const favoriteTimestamp = '2026-06-01T00:00:00.000Z';
const healthRecommendationsViewedEvent =
    'game_plant_health_recommendations_viewed';

type AnalyticsEvent = {
    eventName: string;
    properties?: Record<string, unknown>;
};

declare global {
    interface Window {
        recordGameAnalyticsEvent?: (event: unknown) => void;
    }
}

function favoriteItem({
    entityId,
    entityType,
}: {
    entityId: number;
    entityType: FavoriteEntityType;
}): FavoriteItem {
    return {
        id: entityId,
        entityType,
        entityId,
        createdAt: favoriteTimestamp,
        updatedAt: favoriteTimestamp,
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isFavoriteRequestBody(value: unknown): value is {
    entityType: FavoriteEntityType;
    entityId: number;
    favorited: boolean;
} {
    if (!isRecord(value)) {
        return false;
    }

    return (
        typeof value.entityType === 'string' &&
        ['plant', 'plantSort', 'operation'].includes(value.entityType) &&
        typeof value.entityId === 'number' &&
        typeof value.favorited === 'boolean'
    );
}

async function mockFavoriteRequests(
    page: Page,
    initialFavorites: FavoriteItem[],
) {
    let favorites = [...initialFavorites];

    await page.route('**/api/gredice/api/favorites**', async (route) => {
        const request = route.request();

        if (request.method() === 'PUT') {
            const body = request.postDataJSON();
            if (!isFavoriteRequestBody(body)) {
                throw new Error('Invalid favorite request body');
            }
            favorites = body.favorited
                ? [
                      favoriteItem({
                          entityType: body.entityType,
                          entityId: body.entityId,
                      }),
                      ...favorites.filter(
                          (favorite) =>
                              favorite.entityType !== body.entityType ||
                              favorite.entityId !== body.entityId,
                      ),
                  ]
                : favorites.filter(
                      (favorite) =>
                          favorite.entityType !== body.entityType ||
                          favorite.entityId !== body.entityId,
                  );

            await route.fulfill({
                body: JSON.stringify({
                    favorited: body.favorited,
                    favorite: body.favorited
                        ? favoriteItem({
                              entityType: body.entityType,
                              entityId: body.entityId,
                          })
                        : null,
                }),
                contentType: 'application/json',
                status: 200,
            });
            return;
        }

        await route.fulfill({
            body: JSON.stringify({ favorites }),
            contentType: 'application/json',
            status: 200,
        });
    });
}

async function captureGameAnalyticsEvents(page: Page) {
    const analyticsEvents: AnalyticsEvent[] = [];

    await page.exposeFunction('recordGameAnalyticsEvent', (event: unknown) => {
        if (!isRecord(event) || typeof event.eventName !== 'string') {
            return;
        }

        analyticsEvents.push({
            eventName: event.eventName,
            properties: isRecord(event.properties)
                ? event.properties
                : undefined,
        });
    });

    await page.evaluate(() => {
        window.addEventListener('gredice:game-analytics', (event) => {
            if (event instanceof CustomEvent) {
                window.recordGameAnalyticsEvent?.(event.detail);
            }
        });
    });

    return analyticsEvents;
}

function countAnalyticsEvents(
    analyticsEvents: AnalyticsEvent[],
    eventName: string,
) {
    return analyticsEvents.filter((event) => event.eventName === eventName)
        .length;
}

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

function checkedOutScheduledScenario(): RaisedBedScenario {
    return {
        fields: [
            {
                positionIndex: 0,
                plantSortId: testSorts.tomato.id,
                plantStatus: 'planned',
                plantScheduledDate: '2026-05-20T00:00:00.000Z',
            },
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
    const operations = [
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
    ];
    const tomatoSortWithOperations = {
        ...testSorts.tomato,
        information: {
            ...testSorts.tomato.information,
            plant: {
                ...testSorts.tomato.information.plant,
                information: {
                    ...testSorts.tomato.information.plant.information,
                    operations,
                },
            },
        },
    };

    return {
        ...plantedGrowingScenario(),
        operations,
        sorts: [tomatoSortWithOperations],
        operationHistoryItems: [
            {
                id: 801,
                entityId: 201,
                entityTypeName: 'operation',
                raisedBedId: 1,
                raisedBedFieldId: 1,
                status: 'completed',
                createdAt: '2026-05-09T00:00:00.000Z',
                scheduledDate: '2026-05-10T00:00:00.000Z',
                scheduledAt: '2026-05-09T00:00:00.000Z',
                completedAt: '2026-05-10T08:00:00.000Z',
                verifiedAt: '2026-05-10T09:00:00.000Z',
                canceledAt: null,
                imageUrls: [],
                completionNotes: null,
                targetLabel: 'Raised Bed 1 › Polje 1',
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
        ],
    };
}

function plantedGrowingWithHealthRecommendedOperationsScenario(): RaisedBedScenario {
    const scenario = plantedGrowingWithRecommendedOperationsScenario();
    const healthOperation = buildOperation({
        id: 203,
        name: 'mock-pest-rinse',
        label: 'Ispiranje biljke od štetnika',
        stageName: 'maintenance',
        stageLabel: 'Održavanje',
        relativeDays: 3,
    });
    const tomatoPlantWithHealth = {
        ...testSorts.tomato.information.plant,
        health: {
            pests: [
                {
                    id: 501,
                    slug: 'mock-aphids',
                    name: 'Lisne uši',
                    kind: 'pest',
                    operations: {
                        reduction: [
                            {
                                id: healthOperation.id,
                                slug: healthOperation.slug,
                                name: healthOperation.information.name,
                                label: healthOperation.information.label,
                            },
                        ],
                    },
                },
            ],
        },
    } satisfies PlantData;

    return {
        ...scenario,
        operations: [...(scenario.operations ?? []), healthOperation],
        plants: [
            tomatoPlantWithHealth,
            testSorts.basil.information.plant,
            testSorts.lettuce.information.plant,
        ],
    };
}

function greenhouseSeedlingScenario(): RaisedBedScenario {
    return {
        fields: [
            {
                positionIndex: 0,
                plantSortId: testSorts.tomato.id,
                plantStatus: 'sprouted',
                sowingLocation: 'greenhouse',
                plantSowDate: '2026-05-01T00:00:00.000Z',
                plantGrowthDate: '2026-05-10T00:00:00.000Z',
            },
        ],
        operations: [
            buildOperation({
                id: 402,
                name: 'mock-seedling-check',
                label: 'Kontrola sadnice',
                stageName: 'maintenance',
                stageLabel: 'Održavanje',
                relativeDays: 2,
            }),
            buildOperation({
                id: 593,
                name: 'seedlingTranslanting',
                label: 'Presađivanje sadnice',
                stageName: 'planting',
                stageLabel: 'Sadnja',
                relativeDays: 14,
            }),
        ],
    };
}

function plantedGrowingWithOperationHistoryScenario(): RaisedBedScenario {
    const wateringOperation = buildOperation({
        id: 301,
        name: 'mock-history-watering',
        label: 'Površinsko zalijevanje gredice (20L)',
        stageName: 'maintenance',
        stageLabel: 'Održavanje',
    });
    const tomatoSortWithOperation = {
        ...testSorts.tomato,
        information: {
            ...testSorts.tomato.information,
            plant: {
                ...testSorts.tomato.information.plant,
                information: {
                    ...testSorts.tomato.information.plant.information,
                    operations: [wateringOperation],
                },
            },
        },
    };

    return {
        ...plantedGrowingScenario(),
        operations: [wateringOperation],
        sorts: [tomatoSortWithOperation],
        operationDiaryEntries: [
            {
                id: 991,
                name: 'Savjeti suncokreta',
                description:
                    '## Sažetak stanja\n\nBiljka izgleda dobro nakon zalijevanja.',
                status: null,
                timestamp: new Date('2026-05-10T10:00:00.000Z'),
                imageUrls: ['https://example.com/watering.jpg'],
                isMarkdown: true,
            },
        ],
        operationHistoryItems: [
            {
                id: 901,
                entityId: wateringOperation.id,
                entityTypeName: 'operation',
                raisedBedId: 1,
                raisedBedFieldId: 1,
                status: 'confirmed',
                createdAt: '2026-05-10T00:00:00.000Z',
                scheduledDate: '2026-05-10T00:00:00.000Z',
                scheduledAt: '2026-05-09T00:00:00.000Z',
                completedAt: '2026-05-10T08:00:00.000Z',
                verifiedAt: null,
                canceledAt: null,
                imageUrls: ['https://example.com/watering.jpg'],
                completionNotes: 'Biljka je zalivena nakon pregleda tla.',
                targetLabel: 'Raised Bed 1 › Polje 1',
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
                        status: 'assigned',
                        changedAt: '2026-05-10T07:00:00.000Z',
                    },
                    {
                        status: 'confirmed',
                        changedAt: '2026-05-10T08:00:00.000Z',
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
                targetLabel: 'Raised Bed 1 › Polje 99',
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

function plantedGrowingWithPendingOperationHistoryScenario(): RaisedBedScenario {
    const scenario = plantedGrowingWithOperationHistoryScenario();
    const operation = scenario.operations?.[0];

    if (!operation) {
        return scenario;
    }

    return {
        ...scenario,
        operationHistoryItems: [
            ...(scenario.operationHistoryItems ?? []),
            {
                id: 903,
                entityId: operation.id,
                entityTypeName: 'operation',
                raisedBedId: 1,
                raisedBedFieldId: 1,
                status: 'confirmed',
                createdAt: '2026-06-23T00:00:00.000Z',
                scheduledDate: '2026-06-24T00:00:00.000Z',
                scheduledAt: '2026-06-23T00:00:00.000Z',
                completedAt: null,
                verifiedAt: null,
                canceledAt: null,
                imageUrls: [],
                completionNotes: null,
                targetLabel: 'Raised Bed 1 › Polje 1',
                statusHistory: [
                    {
                        status: 'planned',
                        changedAt: '2026-06-23T00:00:00.000Z',
                    },
                    {
                        status: 'assigned',
                        changedAt: '2026-06-23T08:00:00.000Z',
                    },
                    {
                        status: 'confirmed',
                        changedAt: '2026-06-23T09:00:00.000Z',
                    },
                ],
            },
        ],
    };
}

function raisedBedScrollableOperationHistoryScenario(): RaisedBedScenario {
    const scenario = plantedGrowingWithOperationHistoryScenario();
    const baseOperationHistoryItem = scenario.operationHistoryItems?.[0];

    if (!baseOperationHistoryItem) {
        return scenario;
    }

    return {
        ...scenario,
        operationHistoryItems: Array.from({ length: 7 }).map((_, index) => ({
            ...baseOperationHistoryItem,
            id: 950 + index,
            completedAt: `2026-05-${String(10 - index).padStart(2, '0')}T08:00:00.000Z`,
            completionNotes: `Zapis radnje ${index + 1}.`,
            imageUrls: index === 0 ? baseOperationHistoryItem.imageUrls : [],
            raisedBedFieldId:
                index % 2 === 0
                    ? baseOperationHistoryItem.raisedBedFieldId
                    : null,
            scheduledDate: `2026-05-${String(10 - index).padStart(2, '0')}T00:00:00.000Z`,
            targetLabel:
                index % 2 === 0
                    ? baseOperationHistoryItem.targetLabel
                    : 'Raised Bed 1',
        })),
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

    test('checked out scheduled field shows scheduled date badge until sown', async ({
        mount,
        page,
    }) => {
        await mount(
            <RaisedBedFieldHudStory
                scenario={checkedOutScheduledScenario()}
                positionIndex={0}
            />,
        );

        const fieldButton = page.getByRole('button').first();
        const scheduledBadge = fieldButton.locator(
            '[data-scheduled-sowing-badge]',
        );
        await expect(scheduledBadge).toBeVisible();
        await expect(scheduledBadge).toContainText('20');
    });

    test('sown scheduled field does not show scheduled date badge', async ({
        mount,
        page,
    }) => {
        await mount(
            <RaisedBedFieldHudStory
                scenario={plantedSownWithScheduledScenario()}
                positionIndex={0}
            />,
        );

        await expect(page.locator('[data-scheduled-sowing-badge]')).toHaveCount(
            0,
        );
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

    test('greenhouse seedling field shows two-stage progress, diary, standard operations, and transplant action', async ({
        mount,
        page,
    }) => {
        await mount(
            <RaisedBedFieldHudStory
                scenario={greenhouseSeedlingScenario()}
                positionIndex={0}
            />,
        );

        await expect(
            page.locator('[data-greenhouse-seedling-visual]').first(),
        ).toBeVisible();
        await expect(page.locator('[data-field-icon-stack]')).toBeVisible();

        await page.getByRole('button').first().click();

        const dialog = page.getByRole('dialog');
        await expect(
            dialog.getByRole('heading', {
                name: /Sadnica u stakleniku "Cherry rajčica"/,
            }),
        ).toBeVisible();
        await expect(
            dialog.locator('[data-greenhouse-seedling-progress] svg'),
        ).toHaveCount(2);
        await expect(dialog.getByText('Sadnica je u stakleniku')).toBeVisible();
        await expect(
            dialog.getByRole('button', { name: 'Klijanje: 9 dana' }),
        ).toBeVisible();
        await expect(
            dialog.getByRole('button', {
                name: /Presađivanje: \d+ dana/,
            }),
        ).toBeVisible();
        await expect(
            dialog.getByRole('tab', { name: /Dnevnik/ }),
        ).toBeVisible();
        await dialog
            .locator('[data-recommendation-section="operations"]')
            .getByRole('button', { name: /Radnje/ })
            .click();
        await expect(
            dialog.getByRole('button', { name: /Kontrola sadnice/ }),
        ).toBeVisible();
        await expect(
            dialog.locator('[data-greenhouse-transplant-action]'),
        ).toContainText('Presađivanje sadnice');
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
            stack.locator('button.bg-blue-600 svg.lucide-sprout'),
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
            stack.locator('button.bg-green-600 svg.lucide-check'),
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
            stack.locator('button.bg-blue-600 svg.lucide-sprout'),
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
        await expect(
            dialog.getByRole('heading', { name: 'Preporuke' }),
        ).toBeVisible();
        await expect(dialog.getByText('Preporučene radnje')).toHaveCount(0);

        const operationsSection = dialog.locator(
            '[data-recommendation-section="operations"]',
        );
        await expect(operationsSection).toBeVisible();
        await expect(
            operationsSection.locator('svg.lucide-hammer'),
        ).toBeVisible();
        await expect(
            operationsSection.locator('[data-recommendation-section-icon]'),
        ).not.toHaveClass(/green/);
        await expect(
            operationsSection.locator('[data-recommendation-section-count]'),
        ).toHaveClass(/size-5/);
        await expect(operationsSection.getByTitle('2 preporuka')).toBeVisible();

        const recommendationsList = dialog.locator(
            '[data-recommended-operation-list]',
        );
        await expect(recommendationsList).toHaveCount(0);

        const operationsHeader = operationsSection.getByRole('button', {
            name: /Radnje/,
        });
        await operationsHeader.click();

        await expect(recommendationsList).toBeVisible();
        await expect(recommendationsList).toContainText('Okopavanje');
        await expect(recommendationsList).toContainText('Uklanjanje korova');
        await expect(
            recommendationsList.locator('[data-operation-id="201"]'),
        ).toContainText('Zakazano');
        await expect(
            recommendationsList.locator('[data-operation-id="202"]'),
        ).not.toContainText('Zakazano');

        await operationsHeader.click();
        await expect(operationsSection.getByTitle('2 preporuka')).toBeVisible();
        await expect(recommendationsList).toHaveCount(0);
        await operationsHeader.click();
        await expect(recommendationsList).toBeVisible();

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
        await expect(
            dialog
                .locator('[role="tabpanel"]:not([hidden])')
                .locator('[data-scroll-view]'),
        ).toBeVisible();
        await expect(
            dialog
                .getByRole('tabpanel', { name: 'Radnje' })
                .locator('[data-operation-id="201"]'),
        ).toContainText('Zakazano');
    });

    test('recommendations group plant health operations with collapsed counts', async ({
        mount,
        page,
    }) => {
        const analyticsEvents = await captureGameAnalyticsEvents(page);

        await mount(
            <RaisedBedFieldHudStory
                scenario={plantedGrowingWithHealthRecommendedOperationsScenario()}
                positionIndex={0}
            />,
        );

        await page.getByRole('button').first().click();

        const dialog = page.getByRole('dialog');
        const healthSection = dialog.locator(
            '[data-recommendation-section="health"]',
        );
        await expect(healthSection).toBeVisible();
        await expect(healthSection.locator('svg.lucide-plus')).toBeVisible();
        await expect(
            healthSection.locator('[data-recommendation-section-icon]'),
        ).not.toHaveClass(/green/);
        await expect(
            healthSection.locator('[data-recommendation-section-count]'),
        ).toHaveClass(/size-5/);
        await expect(healthSection.getByTitle('1 preporuka')).toBeVisible();

        const healthList = healthSection.locator(
            '[data-plant-health-operation-list]',
        );
        await expect(healthList).toHaveCount(0);
        await expect
            .poll(() =>
                countAnalyticsEvents(
                    analyticsEvents,
                    healthRecommendationsViewedEvent,
                ),
            )
            .toBe(0);

        const healthHeader = healthSection.getByRole('button', {
            name: /Zdravlje biljke/,
        });
        await healthHeader.click();

        await expect(healthSection.getByText('Lisne uši')).toBeVisible();
        await expect(healthList).toBeVisible();
        await expect(healthList).toContainText('Ispiranje biljke od štetnika');
        await expect
            .poll(() =>
                countAnalyticsEvents(
                    analyticsEvents,
                    healthRecommendationsViewedEvent,
                ),
            )
            .toBe(1);

        await healthHeader.click();
        await expect(healthSection.getByTitle('1 preporuka')).toBeVisible();
        await expect(healthList).toHaveCount(0);
        await healthHeader.click();
        await expect
            .poll(() =>
                countAnalyticsEvents(
                    analyticsEvents,
                    healthRecommendationsViewedEvent,
                ),
            )
            .toBe(1);
    });

    test('favorite operations are ranked first in recommendations and operation choices', async ({
        mount,
        page,
    }) => {
        const favorites = [
            favoriteItem({ entityType: 'operation', entityId: 202 }),
        ];
        await mockFavoriteRequests(page, favorites);

        await mount(
            <RaisedBedFieldHudStory
                favorites={favorites}
                scenario={plantedGrowingWithRecommendedOperationsScenario()}
                positionIndex={0}
            />,
        );

        await page.getByRole('button').first().click();

        const dialog = page.getByRole('dialog');
        await dialog
            .locator('[data-recommendation-section="operations"]')
            .getByRole('button', { name: /Radnje/ })
            .click();
        const recommendationsList = dialog.locator(
            '[data-recommended-operation-list]',
        );
        const recommendedOperationRows = recommendationsList.locator(
            '[data-operation-id]',
        );
        await expect(recommendedOperationRows.first()).toContainText(
            'Uklanjanje korova',
        );

        await recommendationsList
            .getByRole('button', {
                name: 'Sve radnje...',
            })
            .click();

        const operationsPanel = dialog.getByRole('tabpanel', {
            name: 'Radnje',
        });
        const operationRows = operationsPanel.locator('[data-operation-id]');
        await expect(operationRows.first()).toContainText('Uklanjanje korova');

        const favoritedOperationRow = operationsPanel.locator(
            '[data-operation-id="202"]',
        );
        await expect(
            favoritedOperationRow.getByRole('button', {
                name: 'Ukloni radnju iz omiljenih',
            }),
        ).toBeVisible();
    });

    test('operation item click opens scheduling without a separate schedule action', async ({
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
        await dialog.getByRole('tab', { name: /Radnje/ }).click();

        const operationsPanel = dialog.getByRole('tabpanel', {
            name: 'Radnje',
        });
        await expect(
            operationsPanel.getByRole('button', { name: 'Zakaži' }),
        ).toHaveCount(0);

        const operationRow = operationsPanel.locator(
            '[data-operation-id="201"]',
        );
        await operationRow.getByRole('button', { name: /Okopavanje/ }).click();

        const scheduleDialog = page.getByRole('dialog', {
            name: 'Zakaži radnju: Okopavanje',
        });
        await expect(
            scheduleDialog.locator('[data-event-calendar]'),
        ).toBeVisible();
        await expect(
            scheduleDialog.getByText('Zakazivanje radnje'),
        ).toBeVisible();
    });

    test('operation scheduling calendar shows previous history with icon details', async ({
        mount,
        page,
    }) => {
        await mount(
            <RaisedBedFieldHudStory
                scenario={plantedGrowingWithPendingOperationHistoryScenario()}
                positionIndex={0}
            />,
        );

        await page.getByRole('button').first().click();

        const dialog = page.getByRole('dialog');
        await dialog.getByRole('tab', { name: /Radnje/ }).click();

        const operationRow = dialog.locator('[data-operation-id="301"]');
        await operationRow
            .getByRole('button', {
                name: /Površinsko zalijevanje gredice/,
            })
            .click();

        const scheduleDialog = page.getByRole('dialog', {
            name: 'Zakaži radnju: Površinsko zalijevanje gredice (20L)',
        });
        await expect(
            scheduleDialog.locator('[data-event-calendar]'),
        ).toBeVisible();

        await expect(
            scheduleDialog.getByRole('button', {
                name: 'Prethodni mjesec',
            }),
        ).toBeEnabled();
        await scheduleDialog
            .getByRole('button', { name: 'Prethodni mjesec' })
            .click();

        await expect(
            scheduleDialog.locator('[data-event-calendar-month="2026-05"]'),
        ).toBeVisible();
        await expect(
            scheduleDialog.locator('[data-event-calendar-tone="completed"]'),
        ).toHaveClass(/bg-primary/);

        await scheduleDialog
            .getByRole('button', {
                name: /10\. 05\. 2026.*Površinsko zalijevanje/u,
            })
            .click();

        await expect(
            page.locator('[data-event-calendar-entry-visual]'),
        ).toBeVisible();
        await expect(
            page.getByText('Obavljeno · Raised Bed 1 › Polje 1'),
        ).toBeVisible();
        await expect(page.getByText(/30 min/)).toHaveCount(0);

        await page.keyboard.press('Escape');
        await scheduleDialog
            .getByRole('button', { name: 'Sljedeći mjesec' })
            .click();
        await expect(
            scheduleDialog.locator('[data-event-calendar-month="2026-06"]'),
        ).toBeVisible();
        await scheduleDialog
            .getByRole('button', {
                name: /24\. 06\. 2026.*Površinsko zalijevanje/u,
            })
            .click();
        await expect(
            page.getByText('Zakazano · Raised Bed 1 › Polje 1'),
        ).toBeVisible();
    });

    test('diary tab shows filtered operation history with photos and notes', async ({
        mount,
        page,
    }) => {
        await mount(
            <RaisedBedFieldHudStory
                scenario={plantedGrowingWithOperationHistoryScenario()}
                positionIndex={0}
            />,
        );

        await page.getByRole('button').first().click();

        const dialog = page.getByRole('dialog');
        await dialog.getByRole('tab', { name: /Dnevnik/ }).click();

        await expect(
            dialog.getByText('Površinsko zalijevanje gredice (20L)'),
        ).toBeVisible();
        await expect(
            dialog.getByText('Biljka je zalivena nakon pregleda tla.'),
        ).toBeVisible();
        await expect(dialog.locator('[data-operation-images]')).toBeVisible();
        await expect(
            dialog.locator('[data-garden-operation-card]').first(),
        ).toHaveClass(/bg-card/u);
        await expect(
            dialog.getByRole('button', {
                name: /Pregledaj savjete suncokreta/u,
            }),
        ).toBeVisible();
        await expect(
            dialog.getByRole('button', {
                name: /Pitaj suncokret za savjete/u,
            }),
        ).toHaveCount(0);
        await expect(
            dialog.getByText('Ovo je zapis za drugo polje.'),
        ).toHaveCount(0);
        expect(
            await dialog.evaluate(
                (element) => element.scrollWidth - element.clientWidth,
            ),
        ).toBeLessThanOrEqual(1);
    });

    test('closeup HUD photo shortcut opens the raised bed photos modal', async ({
        mount,
        page,
    }) => {
        await mount(
            <RaisedBedCloseupHudStory
                scenario={plantedGrowingWithOperationHistoryScenario()}
            />,
        );

        const photoButton = page.getByRole('button', {
            name: /Fotografije gredice Raised Bed 1/u,
        });
        await expect(photoButton).toBeVisible();
        await expect(photoButton.locator('img')).toBeVisible();

        await photoButton.click();

        const photosModal = page.locator('[data-raised-bed-photos-modal]');
        await expect(
            photosModal.getByRole('heading', { name: 'Fotografije gredice' }),
        ).toBeVisible();
        await expect(
            photosModal.getByText('Površinsko zalijevanje gredice (20L)'),
        ).toBeVisible();
        await expect(
            photosModal.locator('[data-raised-bed-photo-entry]'),
        ).toHaveCount(1);
        await expect(
            photosModal.getByRole('button', {
                name: /Pregledaj savjete suncokreta/u,
            }),
        ).toBeVisible();
    });

    test('closeup HUD photo shortcut searches older history pages before hiding', async ({
        mount,
        page,
    }) => {
        const scenario = plantedGrowingWithOperationHistoryScenario();
        const baseOperation = scenario.operationHistoryItems?.[0];

        if (!baseOperation) {
            throw new Error('Expected operation history item.');
        }

        const firstPageWithoutPhotos = Array.from({ length: 20 }).map(
            (_, index) => ({
                ...baseOperation,
                id: 800 + index,
                imageUrls: [],
                completionNotes: null,
                statusHistory: [
                    {
                        status: 'completed' as const,
                        changedAt: `2026-05-${String(12 - Math.floor(index / 2)).padStart(2, '0')}T09:00:00.000Z`,
                    },
                ],
            }),
        );
        const olderOperationWithPhoto = {
            ...baseOperation,
            id: 999,
            completedAt: '2026-04-20T08:00:00.000Z',
            imageUrls: ['https://example.com/older-watering.jpg'],
            completionNotes: 'Starija fotografija nakon pregleda tla.',
            statusHistory: [
                {
                    status: 'completed' as const,
                    changedAt: '2026-04-20T09:00:00.000Z',
                },
            ],
        };

        await page.route(
            '**/api/gredice/api/gardens/*/operations**',
            async (route) => {
                const url = new URL(route.request().url());
                const cursor = url.searchParams.get('cursor');

                await route.fulfill({
                    body: JSON.stringify({
                        items: cursor === '20' ? [olderOperationWithPhoto] : [],
                        nextCursor: null,
                        total: 21,
                    }),
                    contentType: 'application/json',
                    status: 200,
                });
            },
        );

        await mount(
            <RaisedBedCloseupHudStory
                scenario={{
                    ...scenario,
                    operationHistoryItems: firstPageWithoutPhotos,
                    operationHistoryNextCursor: 20,
                }}
            />,
        );

        const photoButton = page.getByRole('button', {
            name: /Fotografije gredice Raised Bed 1/u,
        });
        await expect(photoButton).toBeVisible();
        await expect(photoButton.locator('img')).toBeVisible();

        await photoButton.click();

        const photosModal = page.locator('[data-raised-bed-photos-modal]');
        await expect(
            photosModal.getByText('Starija fotografija nakon pregleda tla.'),
        ).toBeVisible();
        await expect(
            photosModal.locator('[data-raised-bed-photo-entry]'),
        ).toHaveCount(1);
    });

    test('plant modal header opens field-scoped photos with AI actions', async ({
        mount,
        page,
    }) => {
        await mount(
            <RaisedBedFieldHudStory
                scenario={plantedGrowingWithOperationHistoryScenario()}
                positionIndex={0}
            />,
        );

        await page.getByRole('button').first().click();

        const plantDialog = page.getByRole('dialog');
        const photoButton = plantDialog.getByRole('button', {
            name: /Fotografije biljke Cherry rajčica/u,
        });
        await expect(photoButton).toBeVisible();

        await photoButton.click();

        const photosModal = page.locator('[data-raised-bed-photos-modal]');
        await expect(
            photosModal.getByRole('heading', { name: 'Fotografije biljke' }),
        ).toBeVisible();
        await expect(photosModal.getByText('Cherry rajčica')).toBeVisible();
        await expect(
            photosModal.getByText('Površinsko zalijevanje gredice (20L)'),
        ).toBeVisible();
        await expect(
            photosModal.getByRole('button', {
                name: /Pregledaj savjete suncokreta/u,
            }),
        ).toBeVisible();
        await expect(
            photosModal.getByText('Ovo je zapis za drugo polje.'),
        ).toHaveCount(0);
    });

    test('diary tab allows rescheduling future active operation cards', async ({
        mount,
        page,
    }) => {
        const scenario = plantedGrowingWithOperationHistoryScenario();
        const operation = scenario.operationHistoryItems?.[0];

        if (!operation) {
            throw new Error('Expected operation history item.');
        }

        await mount(
            <RaisedBedFieldHudStory
                scenario={{
                    ...scenario,
                    operationHistoryItems: [
                        {
                            ...operation,
                            scheduledDate: '2026-05-20T00:00:00.000Z',
                            scheduledAt: '2026-05-19T00:00:00.000Z',
                            completedAt: null,
                            verifiedAt: null,
                            imageUrls: [],
                            completionNotes: null,
                        },
                    ],
                }}
                positionIndex={0}
            />,
        );

        await page.getByRole('button').first().click();

        const dialog = page.getByRole('dialog');
        await dialog.getByRole('tab', { name: /Dnevnik/ }).click();

        await expect(
            dialog.getByText('Površinsko zalijevanje gredice (20L)'),
        ).toBeVisible();
        await expect(dialog.getByText('Zakazano:')).toHaveCount(0);
        await expect(
            dialog.locator('[data-operation-media="plant"]').first(),
        ).toBeVisible();
        await expect(
            dialog.locator('[data-operation-media-badge]').first(),
        ).toBeVisible();

        await dialog.getByRole('button', { name: '20. svibnja 2026.' }).click();

        await expect(
            page.getByText('Novi datum', { exact: true }),
        ).toBeVisible();
        await expect(
            page.getByRole('button', { name: 'Spremi' }),
        ).toBeVisible();
    });

    test('diary tab disables same-day schedule changes with a tooltip', async ({
        mount,
        page,
    }) => {
        const scenario = plantedGrowingWithOperationHistoryScenario();
        const operation = scenario.operationHistoryItems?.[0];

        if (!operation) {
            throw new Error('Expected operation history item.');
        }

        await mount(
            <RaisedBedFieldHudStory
                scenario={{
                    ...scenario,
                    operationHistoryItems: [
                        {
                            ...operation,
                            status: 'planned',
                            scheduledDate: '2026-05-13T00:00:00.000Z',
                            scheduledAt: '2026-05-12T00:00:00.000Z',
                            completedAt: null,
                            verifiedAt: null,
                            imageUrls: [],
                            completionNotes: null,
                            statusHistory: [
                                {
                                    status: 'new',
                                    changedAt: '2026-05-12T00:00:00.000Z',
                                },
                                {
                                    status: 'planned',
                                    changedAt: '2026-05-12T00:00:00.000Z',
                                },
                            ],
                        },
                    ],
                }}
                positionIndex={0}
            />,
        );

        await page.getByRole('button').first().click();

        const dialog = page.getByRole('dialog');
        await dialog.getByRole('tab', { name: /Dnevnik/ }).click();

        const scheduleButton = dialog.getByRole('button', {
            name: '13. svibnja 2026.',
        });
        await expect(scheduleButton).toBeDisabled();

        await scheduleButton.locator('xpath=..').hover();
        await expect(
            page
                .getByRole('tooltip')
                .getByText(
                    'Datum radnje zakazane za danas više nije moguće promijeniti.',
                ),
        ).toBeVisible();
    });

    test('diary tab shows Zakaži for active operation cards without a scheduled date', async ({
        mount,
        page,
    }) => {
        const scenario = plantedGrowingWithOperationHistoryScenario();
        const operation = scenario.operationHistoryItems?.[0];

        if (!operation) {
            throw new Error('Expected operation history item.');
        }

        await mount(
            <RaisedBedFieldHudStory
                scenario={{
                    ...scenario,
                    operationHistoryItems: [
                        {
                            ...operation,
                            status: 'planned',
                            scheduledDate: null,
                            scheduledAt: null,
                            completedAt: null,
                            verifiedAt: null,
                            imageUrls: [],
                            completionNotes: null,
                            statusHistory: [
                                {
                                    status: 'new',
                                    changedAt: '2026-05-12T00:00:00.000Z',
                                },
                            ],
                        },
                    ],
                }}
                positionIndex={0}
            />,
        );

        await page.getByRole('button').first().click();

        const dialog = page.getByRole('dialog');
        await dialog.getByRole('tab', { name: /Dnevnik/ }).click();
        await dialog.getByRole('button', { name: 'Zakaži' }).click();

        await expect(
            page.getByText('Novi datum', { exact: true }),
        ).toBeVisible();
        await expect(
            page.getByRole('button', { name: 'Spremi' }),
        ).toBeVisible();
    });

    test('diary tab shows completed schedule dates as text instead of buttons', async ({
        mount,
        page,
    }) => {
        await mount(
            <RaisedBedFieldHudStory
                scenario={plantedGrowingWithOperationHistoryScenario()}
                positionIndex={0}
            />,
        );

        await page.getByRole('button').first().click();

        const dialog = page.getByRole('dialog');
        await dialog.getByRole('tab', { name: /Dnevnik/ }).click();

        await expect(dialog.getByText('10. svibnja 2026.')).toBeVisible();
        await expect(
            dialog.getByRole('button', { name: '10. svibnja 2026.' }),
        ).toHaveCount(0);
    });

    test('raised bed diary operation history does not overflow the modal', async ({
        mount,
        page,
    }) => {
        await mount(
            <RaisedBedInfoModalStory
                scenario={plantedGrowingWithOperationHistoryScenario()}
            />,
        );

        const dialog = page.getByRole('dialog');
        await expect(
            dialog.getByText('Površinsko zalijevanje gredice (20L)').first(),
        ).toBeVisible();
        await expect(dialog.locator('[data-operation-images]')).toBeVisible();
        await expect(dialog.getByText('Gredica:')).toHaveCount(0);
        await expect(
            dialog.getByLabel('Raised Bed 1 › Polje 1').first(),
        ).toBeVisible();
        await expect(
            dialog.getByRole('button', {
                name: /Pregledaj savjete suncokreta/u,
            }),
        ).toBeVisible();
        expect(
            await dialog.evaluate(
                (element) => element.scrollWidth - element.clientWidth,
            ),
        ).toBeLessThanOrEqual(1);
    });

    test('raised bed diary scroll view uses modal edge scrollbar and overflow fades', async ({
        mount,
        page,
    }) => {
        await mount(
            <RaisedBedInfoModalStory
                scenario={raisedBedScrollableOperationHistoryScenario()}
            />,
        );

        const dialog = page.getByRole('dialog');
        const activePanel = dialog.locator('[role="tabpanel"]:not([hidden])');
        const scrollView = activePanel.locator('[data-scroll-view]').first();
        const viewport = scrollView.locator('[data-scroll-view-viewport]');
        const topFade = scrollView.locator('[data-scroll-view-top-fade]');
        const bottomFade = scrollView.locator('[data-scroll-view-bottom-fade]');
        await expect(scrollView).toBeVisible();
        await expect(topFade).toHaveAttribute('data-visible', 'false');
        await expect(bottomFade).toHaveAttribute('data-visible', 'true');

        await expect
            .poll(async () => {
                const dialogBox = await dialog.boundingBox();
                const viewportBox = await viewport.boundingBox();
                if (!dialogBox || !viewportBox) {
                    return Number.POSITIVE_INFINITY;
                }
                return Math.abs(
                    viewportBox.x +
                        viewportBox.width -
                        (dialogBox.x + dialogBox.width),
                );
            })
            .toBeLessThanOrEqual(2);

        await viewport.evaluate((element) => {
            element.scrollTop = 120;
            element.dispatchEvent(new Event('scroll', { bubbles: true }));
        });
        await expect(topFade).toHaveAttribute('data-visible', 'true');

        await viewport.evaluate((element) => {
            element.scrollTop = element.scrollHeight;
            element.dispatchEvent(new Event('scroll', { bubbles: true }));
        });
        await expect(bottomFade).toHaveAttribute('data-visible', 'false');
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

    test('raised bed more action sits in the header above the tabs', async ({
        mount,
        page,
    }) => {
        await mount(
            <RaisedBedInfoModalStory
                scenario={plantedGrowingWithOperationHistoryScenario()}
            />,
        );

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        const moreButton = dialog.getByRole('button', {
            name: 'Prikaži dodatne opcije gredice',
        });
        const photoButton = dialog.getByRole('button', {
            name: /Fotografije gredice Raised Bed 1/u,
        });
        const tabList = dialog.getByRole('tablist');
        await expect(moreButton).toBeVisible();
        await expect(photoButton).toBeVisible();
        await expect(tabList).toBeVisible();

        await expect
            .poll(async () => {
                const moreBox = await moreButton.boundingBox();
                const tabListBox = await tabList.boundingBox();

                if (!moreBox || !tabListBox) {
                    return Number.POSITIVE_INFINITY;
                }

                return moreBox.y + moreBox.height - tabListBox.y;
            })
            .toBeLessThanOrEqual(0);

        await moreButton.click();
        await expect(
            dialog.getByRole('button', { name: 'Napusti gredicu' }),
        ).toBeVisible();
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
