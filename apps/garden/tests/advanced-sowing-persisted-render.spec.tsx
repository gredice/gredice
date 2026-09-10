import { expect, test } from '@playwright/experimental-ct-react';
import type { Page } from '@playwright/test';
import type { AdvancedSowingGardenPlantingInput } from '../../../packages/game/src/hud/raisedBed/advancedSowingGardenVisuals';
import { AdvancedSowingPersistedStory } from './AdvancedSowingPersistedStory';

const plantSortCoverUrl = null;

function plantSort(id: number, name: string) {
    return { coverUrl: plantSortCoverUrl, id, name };
}

function selectedPlanting(
    overrides: Partial<AdvancedSowingGardenPlantingInput> = {},
): AdvancedSowingGardenPlantingInput {
    return {
        anchorPositionIndex: 17,
        configurationSource: 'selected',
        id: 901,
        isActive: true,
        layoutKey: 'v1:fields:1x1:plants:2x2',
        layoutVersion: 1,
        lifecycleStartedAt: '2026-08-10T08:00:00.000Z',
        lifecycleStatus: 'planned',
        lifecycleVersionEventId: 109,
        memberships: [
            {
                isAnchor: true,
                positionIndex: 17,
                relativeColumn: 0,
                relativeRow: 0,
            },
        ],
        plantCount: 4,
        plantSortId: 42,
        plantsPerAxis: 2,
        selectedSeedingDistanceCm: 15,
        selectedTask: {
            scheduledDate: '2099-08-12T00:00:00.000Z',
            sowingLocation: 'direct',
            status: 'planned',
            verification: null,
        },
        spanColumns: 1,
        spanRows: 1,
        ...overrides,
    };
}

type CapturedOwnerRequest = {
    method: string;
    pathname: string;
    payload: unknown;
};

async function captureOwnerRequest(
    page: Page,
    responseBody: unknown = { created: true },
) {
    let requestCount = 0;
    let resolveRequest: ((request: CapturedOwnerRequest) => void) | undefined;
    const requestPromise = new Promise<CapturedOwnerRequest>((resolve) => {
        resolveRequest = resolve;
    });

    await page.route('**/*', async (route) => {
        const request = route.request();
        const pathname = new URL(request.url()).pathname;
        if (
            !pathname.includes('/gardens/1/raised-beds/1/plantings/901') ||
            (request.method() !== 'POST' && request.method() !== 'PATCH')
        ) {
            await route.fallback();
            return;
        }
        requestCount += 1;
        resolveRequest?.({
            method: request.method(),
            pathname,
            payload: request.postDataJSON(),
        });
        await route.fulfill({
            body: JSON.stringify(responseBody),
            contentType: 'application/json',
            status: 200,
        });
    });

    return {
        getRequestCount: () => requestCount,
        requestPromise,
    };
}

function expectCommandIdentity(
    payload: unknown,
    expectedLifecycleVersionEventId: number,
) {
    expect(payload).toEqual(
        expect.objectContaining({
            commandId: expect.stringMatching(
                /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
            ),
            expectedLifecycleVersionEventId,
            expectedPlantSortId: 42,
        }),
    );
}

test('requires an explicit planting choice for co-plants in one field', async ({
    mount,
    page,
}) => {
    const plantingInputs = [
        selectedPlanting(),
        selectedPlanting({
            id: 902,
            layoutKey: 'v1:fields:1x1:plants:1x1',
            plantCount: 1,
            plantSortId: 43,
            plantsPerAxis: 1,
            selectedSeedingDistanceCm: 30,
        }),
    ];
    const component = await mount(
        <AdvancedSowingPersistedStory
            plantings={plantingInputs}
            plantSorts={[plantSort(42, 'Bosiljak'), plantSort(43, 'Rajčica')]}
        />,
    );

    const footprintTrigger = component.locator(
        '[data-advanced-sowing-footprint]',
    );
    await expect(footprintTrigger).toHaveCount(1);
    await expect(footprintTrigger).toHaveAttribute(
        'data-advanced-sowing-membership-positions',
        '17',
    );
    await expect(
        footprintTrigger.locator('[data-advanced-sowing-field-plant]'),
    ).toHaveCount(2);
    await expect(
        footprintTrigger.getByRole('img', { name: 'Bosiljak' }),
    ).toBeVisible();
    await expect(
        footprintTrigger.getByText('4 × 4', { exact: true }),
    ).toHaveCount(0);

    const tomatoSegment = component.locator(
        '[data-advanced-sowing-field-segment="advanced:902"]',
    );
    const triggerBox = await tomatoSegment.boundingBox();
    expect(triggerBox?.width).toBeGreaterThanOrEqual(44);
    expect(triggerBox?.height).toBeGreaterThanOrEqual(44);
    await tomatoSegment.click();

    await expect(page.getByRole('tab', { name: 'Bosiljak' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Rajčica' })).toBeVisible();
    await expect(
        page.locator('[data-advanced-sowing-planting-id="902"]'),
    ).toHaveCount(1);
    const plantingDetails = page.locator(
        '[data-advanced-sowing-planting-id="902"]',
    );
    await expect(
        plantingDetails.getByText('1 biljka', { exact: true }),
    ).toBeVisible();
    await expect(
        plantingDetails.locator('[data-advanced-sowing-density-icon]'),
    ).toHaveAttribute('data-plant-count', '1');
    await expect(plantingDetails.getByRole('img')).toHaveCount(0);
    await expect(
        plantingDetails.getByText('1 × 1', { exact: true }),
    ).toHaveCount(0);
    await expect(plantingDetails.getByText('Razmak')).toHaveCount(0);

    await page.getByRole('tab', { name: 'Bosiljak' }).click();
    await expect(
        page.locator('[data-advanced-sowing-planting-id="901"]'),
    ).toHaveCount(1);
    await expect(
        page.locator(
            '[data-advanced-sowing-planting-id="901"] [data-advanced-sowing-density-icon]',
        ),
    ).toHaveAttribute('data-plant-count', '4');
});

test('keeps advanced field imagery visible without blocking planting mode', async ({
    mount,
}) => {
    const component = await mount(
        <AdvancedSowingPersistedStory
            plantingMode
            plantings={[selectedPlanting()]}
            plantSorts={[plantSort(42, 'Bosiljak')]}
        />,
    );
    const underlyingPicker = component.locator(
        '[data-underlying-plant-picker="true"]',
    );
    await underlyingPicker.evaluate((element) => {
        element.addEventListener('click', () => {
            element.setAttribute('data-clicked', 'true');
        });
    });

    await expect(
        component.locator('[data-advanced-sowing-field-plant="advanced:901"]'),
    ).toBeVisible();
    await expect(
        component.locator(
            '[data-advanced-sowing-details-trigger="advanced:901"]',
        ),
    ).toBeDisabled();
    await underlyingPicker.click({ position: { x: 60, y: 50 } });
    await expect(underlyingPicker).toHaveAttribute('data-clicked', 'true');
});

test('keeps one persisted 2 by 2 planting visible with every membership', async ({
    mount,
    page,
}) => {
    const plantingInputs = [
        selectedPlanting({
            layoutKey: 'v1:fields:2x2:plants:1x1',
            memberships: [
                {
                    isAnchor: true,
                    positionIndex: 17,
                    relativeColumn: 0,
                    relativeRow: 0,
                },
                {
                    isAnchor: false,
                    positionIndex: 16,
                    relativeColumn: 1,
                    relativeRow: 0,
                },
                {
                    isAnchor: false,
                    positionIndex: 14,
                    relativeColumn: 0,
                    relativeRow: 1,
                },
                {
                    isAnchor: false,
                    positionIndex: 13,
                    relativeColumn: 1,
                    relativeRow: 1,
                },
            ],
            plantCount: 1,
            plantsPerAxis: 1,
            selectedSeedingDistanceCm: 60,
            spanColumns: 2,
            spanRows: 2,
        }),
    ];
    const component = await mount(
        <AdvancedSowingPersistedStory
            plantings={plantingInputs}
            plantSorts={[plantSort(42, 'Tikvica')]}
        />,
    );

    const footprintTrigger = component.locator(
        '[data-advanced-sowing-footprint]',
    );
    await expect(footprintTrigger).toHaveCount(1);
    await expect(footprintTrigger).toHaveAttribute(
        'data-advanced-sowing-membership-positions',
        '13,14,16,17',
    );
    await component
        .locator('[data-advanced-sowing-details-trigger="advanced:901"]')
        .first()
        .click();

    await expect(
        page.locator('[data-advanced-sowing-planting-id="901"]'),
    ).toHaveCount(1);
    const plantingDetails = page.locator(
        '[data-advanced-sowing-planting-id="901"]',
    );
    await expect(plantingDetails).toBeVisible();
    const footprint = plantingDetails.getByRole('img', {
        name: 'Polja 14, 15, 17, 18',
        exact: true,
    });
    await expect(footprint).toBeVisible();
    await expect(
        plantingDetails.getByText('4 polja', { exact: true }),
    ).toBeVisible();
    await expect(
        plantingDetails.getByText('1 biljka', { exact: true }),
    ).toBeVisible();
    await expect(
        plantingDetails.getByText('1 × 1', { exact: true }),
    ).toHaveCount(0);
    await expect(footprint.getByText('18', { exact: true })).toHaveCSS(
        'grid-area',
        '1 / 1',
    );
    await expect(footprint.getByText('14', { exact: true })).toHaveCSS(
        'grid-area',
        '2 / 2',
    );
    await expect(page.getByText('Razmak')).toHaveCount(0);
    await expect(page.getByText('Otisak')).toHaveCount(0);
    await expect(
        page.getByRole('tab', { name: 'Biljka', exact: true }),
    ).toBeVisible();
    await expect(
        page.getByRole('tab', { name: 'Dnevnik', exact: true }),
    ).toBeVisible();
    await expect(
        page.getByRole('tab', { name: 'Radnje', exact: true }),
    ).toBeVisible();
    await expect(
        page.getByRole('textbox', { name: 'Razlog otkazivanja' }),
    ).toHaveCount(0);
    await expect(
        page.getByRole('button', { name: 'Prerasporedi', exact: true }),
    ).toHaveCount(0);
    await expect(page.getByText('Planirana', { exact: true })).toBeVisible();
});

test('reschedules a persisted selected task with a fresh command identity', async ({
    mount,
    page,
}) => {
    const capture = await captureOwnerRequest(page, {
        created: true,
        scheduledDate: '2099-08-12T00:00:00.000Z',
        sowingLocation: 'greenhouse',
        status: 'planned',
    });
    await mount(
        <AdvancedSowingPersistedStory
            plantings={[selectedPlanting()]}
            plantSorts={[plantSort(42, 'Bosiljak')]}
        />,
    );

    await page
        .locator('[data-advanced-sowing-details-trigger="advanced:901"]')
        .click();
    await page.getByRole('tab', { name: 'Radnje', exact: true }).click();
    await page
        .getByRole('button', { name: 'Prerasporedi', exact: true })
        .click();
    await page.getByRole('switch', { name: 'Sijanje u stakleniku' }).click();
    await page.getByRole('button', { name: 'Spremi', exact: true }).click();

    const request = await capture.requestPromise;
    expect(request.method).toBe('POST');
    expect(request.pathname.endsWith('/plantings/901/reschedule')).toBe(true);
    expectCommandIdentity(request.payload, 109);
    expect(request.payload).toEqual({
        commandId: expect.any(String),
        expectedLifecycleVersionEventId: 109,
        expectedPlantSortId: 42,
        scheduledDate: '2099-08-12',
        sowingLocation: 'greenhouse',
    });
    await expect(
        page.getByRole('dialog', {
            name: 'Prerasporedi sijanje Bosiljak',
            exact: true,
        }),
    ).toHaveCount(0);
    await expect(page.getByText('109', { exact: true })).toHaveCount(0);
});

test('confirms cancellation and reports the bounded one-per-planting refund', async ({
    mount,
    page,
}) => {
    const capture = await captureOwnerRequest(page, {
        created: true,
        isActive: false,
        lifecycleStatus: 'cancelled',
        refundAmount: 4321,
        status: 'cancelled',
    });
    await mount(
        <AdvancedSowingPersistedStory
            plantings={[selectedPlanting()]}
            plantSorts={[plantSort(42, 'Bosiljak')]}
        />,
    );

    await page
        .locator('[data-advanced-sowing-details-trigger="advanced:901"]')
        .click();
    await page.getByRole('tab', { name: 'Radnje', exact: true }).click();
    await page.getByRole('button', { name: 'Otkaži', exact: true }).click();
    expect(capture.getRequestCount()).toBe(0);
    const confirmation = page.getByRole('dialog', {
        name: 'Otkaži sijanje Bosiljak',
        exact: true,
    });
    await expect(
        confirmation.getByText('Otkazivanje se ne može poništiti.'),
    ).toBeVisible();
    await confirmation
        .getByRole('textbox', { name: 'Razlog otkazivanja' })
        .fill('Promjena plana.');
    await confirmation
        .getByRole('button', { name: 'Otkaži', exact: true })
        .click();

    const request = await capture.requestPromise;
    expect(request.method).toBe('POST');
    expect(request.pathname.endsWith('/plantings/901/cancel')).toBe(true);
    expectCommandIdentity(request.payload, 109);
    expect(request.payload).toEqual({
        commandId: expect.any(String),
        expectedLifecycleVersionEventId: 109,
        expectedPlantSortId: 42,
        reason: 'Promjena plana.',
    });
    await expect(
        page.getByText('Sijanje je otkazano. Vraćeno je 4321 🌻.'),
    ).toBeVisible();
});

test('keeps lifecycle state read-only after farmer completion', async ({
    mount,
    page,
}) => {
    const capture = await captureOwnerRequest(page);
    await mount(
        <AdvancedSowingPersistedStory
            plantings={[
                selectedPlanting({
                    lifecycleStatus: 'sprouted',
                    lifecycleVersionEventId: 210,
                    selectedTask: {
                        scheduledDate: '2026-08-10T00:00:00.000Z',
                        sowingLocation: 'direct',
                        status: 'completed',
                        verification: null,
                    },
                }),
            ]}
            plantSorts={[plantSort(42, 'Bosiljak')]}
        />,
    );

    await page
        .locator('[data-advanced-sowing-details-trigger="advanced:901"]')
        .click();
    await expect(page.getByText('Proklijala', { exact: true })).toBeVisible();
    await expect(
        page.getByText('Nije u fazi rasta', { exact: true }),
    ).toHaveCount(0);
    await expect(
        page.getByText('Datum nije zabilježen', { exact: true }),
    ).toHaveCount(2);
    await expect(page.getByText('Datum promjene statusa')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Označi kao/u })).toHaveCount(
        0,
    );
    await expect(
        page.locator('[data-selected-planting-owner-controls="true"]'),
    ).toHaveCount(0);
    await page.getByRole('tab', { name: 'Radnje', exact: true }).click();
    await expect(
        page.getByRole('button', { name: 'Prerasporedi', exact: true }),
    ).toHaveCount(0);
    await expect(
        page.getByRole('button', { name: 'Otkaži', exact: true }),
    ).toHaveCount(0);
    expect(capture.getRequestCount()).toBe(0);
});

test('keeps pending verification read-only', async ({ mount, page }) => {
    await mount(
        <AdvancedSowingPersistedStory
            plantings={[
                selectedPlanting({
                    lifecycleStatus: 'pendingVerification',
                    selectedTask: {
                        scheduledDate: '2026-08-10T00:00:00.000Z',
                        sowingLocation: 'direct',
                        status: 'pendingVerification',
                        verification: null,
                    },
                }),
            ]}
            plantSorts={[plantSort(42, 'Bosiljak')]}
        />,
    );

    await page
        .locator('[data-advanced-sowing-details-trigger="advanced:901"]')
        .click();
    await expect(
        page.locator('[data-selected-planting-owner-controls="true"]'),
    ).toHaveCount(0);
    await expect(
        page.locator('[data-selected-planting-reschedule="true"]'),
    ).toHaveCount(0);
    await expect(page.getByText('Datum promjene statusa')).toHaveCount(0);
});

test('overlapping footprints expose all co-plants once per occupied field', async ({
    mount,
    page,
}) => {
    const component = await mount(
        <AdvancedSowingPersistedStory
            plantSorts={[plantSort(42, 'Bosiljak'), plantSort(43, 'Tikvica')]}
            plantings={[
                selectedPlanting(),
                selectedPlanting({
                    id: 902,
                    plantSortId: 43,
                    layoutKey: 'v1:fields:2x2:plants:1x1',
                    spanRows: 2,
                    spanColumns: 2,
                    plantCount: 1,
                    plantsPerAxis: 1,
                    selectedSeedingDistanceCm: 60,
                    memberships: [
                        {
                            isAnchor: true,
                            positionIndex: 17,
                            relativeRow: 0,
                            relativeColumn: 0,
                        },
                        {
                            isAnchor: false,
                            positionIndex: 16,
                            relativeRow: 0,
                            relativeColumn: 1,
                        },
                        {
                            isAnchor: false,
                            positionIndex: 14,
                            relativeRow: 1,
                            relativeColumn: 0,
                        },
                        {
                            isAnchor: false,
                            positionIndex: 13,
                            relativeRow: 1,
                            relativeColumn: 1,
                        },
                    ],
                }),
            ]}
        />,
    );
    const sharedField = component.locator(
        '[data-advanced-sowing-field-position="17"]',
    );
    await expect(sharedField).toHaveCount(1);
    await expect(sharedField.getByRole('button')).toHaveCount(2);
    await sharedField
        .locator('[data-advanced-sowing-field-plant="advanced:902"]')
        .click();
    await expect(page.getByRole('tab', { name: 'Bosiljak' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Tikvica' })).toBeVisible();
    await page.keyboard.press('Escape');
    await component
        .locator(
            '[data-advanced-sowing-field-position="16"] [data-advanced-sowing-field-plant="advanced:902"]',
        )
        .click();
    await expect(page.getByRole('tab', { name: 'Bosiljak' })).toHaveCount(0);
    await expect(
        page.locator('[data-advanced-sowing-planting-id="902"]'),
    ).toBeVisible();
    await page.screenshot({
        path: test.info().outputPath('shared-planting-details.png'),
    });
});

test('pending cart entries remain accessible under an existing planting', async ({
    mount,
}) => {
    const component = await mount(
        <AdvancedSowingPersistedStory
            pendingPositionIndices={[17]}
            plantings={[selectedPlanting()]}
            plantSorts={[plantSort(42, 'Bosiljak')]}
        />,
    );
    await expect(
        component.locator('[data-advanced-sowing-field-position="17"]'),
    ).toHaveCount(0);
    await component
        .getByRole('button', { name: 'Sij biljku', exact: true })
        .click({ position: { x: 60, y: 50 } });
});

test('single advanced plant uses the original HUD trigger and lifecycle view', async ({
    mount,
    page,
}) => {
    const component = await mount(
        <AdvancedSowingPersistedStory
            plantings={[selectedPlanting()]}
            plantSorts={[plantSort(42, 'Bosiljak')]}
        />,
    );
    const trigger = component.locator(
        '[data-advanced-sowing-details-trigger="advanced:901"]',
    );
    await expect(trigger.getByText('12.8.', { exact: true })).toBeVisible();
    await trigger.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Biljka "Bosiljak"' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Klijanje:', { exact: true })).toBeVisible();
    await expect(
        dialog.getByText('Planirani datum', { exact: true }),
    ).toBeVisible();
    await expect(
        dialog.getByRole('button', { name: /Spremi|Prerasporedi|Otkaži/u }),
    ).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
});

test('advanced greenhouse planting reuses the seedling HUD without legacy actions', async ({
    mount,
    page,
}) => {
    await mount(
        <AdvancedSowingPersistedStory
            plantSorts={[plantSort(42, 'Bosiljak')]}
            plantings={[
                selectedPlanting({
                    lifecycleStatus: 'sprouted',
                    selectedTask: {
                        scheduledDate: '2026-08-12',
                        status: 'completed',
                        sowingLocation: 'greenhouse',
                        verification: null,
                        completion: {
                            completedAt: '2026-08-12T08:00:00Z',
                            status: 'sowed',
                        },
                    },
                }),
            ]}
        />,
    );
    await page
        .locator('[data-advanced-sowing-details-trigger="advanced:901"]')
        .click();
    const dialog = page.getByRole('dialog', {
        name: 'Sadnica u stakleniku "Bosiljak"',
    });
    await expect(
        dialog.locator('[data-greenhouse-seedling-progress]'),
    ).toBeVisible();
    await expect(dialog.getByText('Sadnica je u stakleniku')).toBeVisible();
    await expect(
        dialog.getByText('Nije proklijalo', { exact: true }),
    ).toHaveCount(0);
    await expect(
        dialog.getByRole('button', { name: /Promijeni stanje|Presadi/u }),
    ).toHaveCount(0);
    await dialog.getByRole('tab', { name: 'Dnevnik', exact: true }).click();
    await expect(dialog.locator('[data-garden-operation-card]')).toHaveCount(1);
    await expect(
        dialog.getByRole('button', { name: 'Otkaži', exact: true }),
    ).toHaveCount(0);
});

test.describe('advanced planting on mobile', () => {
    test.use({ viewport: { width: 390, height: 844 } });
    test('keeps plant information compact and edits inside the existing action drawer', async ({
        mount,
        page,
    }) => {
        await mount(
            <AdvancedSowingPersistedStory
                plantings={[
                    selectedPlanting(),
                    selectedPlanting({ id: 902, plantSortId: 43 }),
                ]}
                plantSorts={[
                    plantSort(42, 'Bosiljak'),
                    plantSort(43, 'Rajčica'),
                ]}
            />,
        );
        await page
            .locator('[data-advanced-sowing-details-trigger="advanced:901"]')
            .click();
        const dialog = page.getByRole('dialog', { name: 'Biljka "Bosiljak"' });
        await expect(
            dialog.getByRole('tab', { name: 'Biljka', exact: true }),
        ).toBeVisible();
        await expect(dialog.getByRole('textbox')).toHaveCount(0);
        await expect
            .poll(() =>
                dialog.evaluate(
                    (element) => element.scrollWidth <= element.clientWidth,
                ),
            )
            .toBe(true);
        await page.screenshot({
            path: test.info().outputPath('existing-field-hud-mobile.png'),
        });
        await dialog.getByRole('tab', { name: 'Rajčica', exact: true }).click();
        const tomatoDialog = page.getByRole('dialog', {
            name: 'Biljka "Rajčica"',
        });
        await expect(tomatoDialog).toBeVisible();
        await tomatoDialog
            .getByRole('tab', { name: 'Radnje', exact: true })
            .click();
        await tomatoDialog
            .getByRole('button', { name: 'Prerasporedi', exact: true })
            .click();
        const actionDialog = page.getByRole('dialog', {
            name: 'Prerasporedi sijanje Rajčica',
            exact: true,
        });
        await expect(actionDialog).toBeVisible();
        await expect(
            actionDialog.getByRole('switch', { name: 'Sijanje u stakleniku' }),
        ).toBeVisible();
        await actionDialog
            .getByRole('button', { name: 'Odustani', exact: true })
            .click();
        await expect(tomatoDialog).toBeVisible();
    });
});
