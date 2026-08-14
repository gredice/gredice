import { expect, test } from '@playwright/experimental-ct-react';
import type { Page } from '@playwright/test';
import type { AdvancedSowingGardenPlantingInput } from '../../../packages/game/src/hud/raisedBed/advancedSowingGardenVisuals';
import { AdvancedSowingPersistedStory } from './AdvancedSowingPersistedStory';

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
            !pathname.includes('/gardens/1/raised-beds/101/plantings/901') ||
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
            plantNames={[
                { id: 42, name: 'Bosiljak' },
                { id: 43, name: 'Rajčica' },
            ]}
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
    const underlyingPicker = component.locator(
        '[data-underlying-plant-picker="true"]',
    );
    await underlyingPicker.evaluate((element) => {
        element.addEventListener('click', () => {
            element.setAttribute('data-clicked', 'true');
        });
    });
    await underlyingPicker.click({ position: { x: 60, y: 50 } });
    await expect(underlyingPicker).toHaveAttribute('data-clicked', 'true');

    const detailsTrigger = component.locator(
        '[data-advanced-sowing-details-trigger]',
    );
    const triggerBox = await detailsTrigger.boundingBox();
    expect(triggerBox?.width).toBeGreaterThanOrEqual(44);
    expect(triggerBox?.height).toBeGreaterThanOrEqual(44);
    await detailsTrigger.click();

    await expect(
        page.locator('[data-advanced-sowing-planting-choice="901"]'),
    ).toBeVisible();
    await expect(
        page.locator('[data-advanced-sowing-planting-choice="902"]'),
    ).toBeVisible();
    await expect(
        page.locator('[data-advanced-sowing-planting-id]'),
    ).toHaveCount(0);

    await page.locator('[data-advanced-sowing-planting-choice="902"]').click();
    await expect(
        page.locator('[data-advanced-sowing-planting-id="902"]'),
    ).toHaveCount(1);
    await expect(page.getByText('30 cm')).toBeVisible();
    await expect(page.getByText('1 × 1 polja')).toBeVisible();
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
            plantNames={[{ id: 42, name: 'Tikvica' }]}
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
    await component.locator('[data-advanced-sowing-details-trigger]').click();

    await expect(
        page.locator('[data-advanced-sowing-planting-id="901"]'),
    ).toHaveCount(1);
    await expect(page.getByText('60 cm')).toBeVisible();
    await expect(page.getByText('2 × 2 polja')).toBeVisible();
    await expect(
        page.getByText('14, 15, 17, 18', { exact: true }),
    ).toBeVisible();
    await expect(
        page.locator('[data-selected-planting-owner-controls="true"]'),
    ).toBeVisible();
    await expect(
        page.getByText('Promijeni termin prije sijanja'),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Otkaži sijanje' }),
    ).toBeVisible();
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
            plantNames={[{ id: 42, name: 'Bosiljak' }]}
        />,
    );

    await page.locator('[data-advanced-sowing-details-trigger]').click();
    await page.getByRole('switch', { name: 'Sijanje u stakleniku' }).click();
    await page.getByRole('button', { name: 'Spremi raspored' }).click();

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
        page.getByText('Novi termin sijanja je spremljen.'),
    ).toBeVisible();
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
            plantNames={[{ id: 42, name: 'Bosiljak' }]}
        />,
    );

    await page.locator('[data-advanced-sowing-details-trigger]').click();
    await page
        .getByRole('textbox', { name: 'Razlog otkazivanja' })
        .fill('Promjena plana.');
    await page.getByRole('button', { name: 'Otkaži sijanje' }).click();
    expect(capture.getRequestCount()).toBe(0);

    const confirmation = page.getByRole('alertdialog', {
        name: 'Potvrda otkazivanja sijanja',
    });
    await expect(
        confirmation.getByText('Otkazivanje se ne može poništiti.'),
    ).toBeVisible();
    await confirmation.getByRole('button', { name: 'Otkaži sijanje' }).click();

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

test('offers the owner graph after direct Admin completion and confirms an effective date', async ({
    mount,
    page,
}) => {
    const capture = await captureOwnerRequest(page, {
        created: true,
        isActive: true,
        lifecycleStatus: 'ready',
        lifecycleStoppedAt: null,
    });
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
            plantNames={[{ id: 42, name: 'Bosiljak' }]}
        />,
    );

    await page.locator('[data-advanced-sowing-details-trigger]').click();
    await expect(
        page.getByText('Sijanje je dovršeno', { exact: false }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Označi kao posijana' }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Označi kao nije proklijala' }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Označi kao spremna za berbu' }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Označi kao uklonjena' }),
    ).toHaveCount(0);

    await page
        .getByRole('button', { name: 'Označi kao spremna za berbu' })
        .click();
    expect(capture.getRequestCount()).toBe(0);
    const confirmation = page.getByRole('alertdialog', {
        name: 'Potvrda promjene stanja',
    });
    await expect(confirmation).toBeVisible();
    await confirmation
        .getByRole('button', { name: 'Promijeni stanje' })
        .click();

    const request = await capture.requestPromise;
    expect(request.method).toBe('PATCH');
    expect(request.pathname.endsWith('/plantings/901')).toBe(true);
    expectCommandIdentity(request.payload, 210);
    expect(request.payload).toEqual({
        commandId: expect.any(String),
        effectiveAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        expectedLifecycleVersionEventId: 210,
        expectedPlantSortId: 42,
        status: 'ready',
    });
});

test('does not remove a logical multi-field planting until explicit confirmation', async ({
    mount,
    page,
}) => {
    const capture = await captureOwnerRequest(page, {
        created: true,
        isActive: false,
        lifecycleStatus: 'removed',
        lifecycleStoppedAt: new Date().toISOString(),
    });
    await mount(
        <AdvancedSowingPersistedStory
            plantings={[
                selectedPlanting({
                    layoutKey: 'v1:fields:2x2:plants:1x1',
                    lifecycleStatus: 'harvested',
                    lifecycleVersionEventId: 333,
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
                    selectedTask: {
                        scheduledDate: '2026-08-10T00:00:00.000Z',
                        sowingLocation: 'direct',
                        status: 'completed',
                        verification: {
                            verifiedAt: '2026-08-10T10:00:00.000Z',
                        },
                    },
                    spanColumns: 2,
                    spanRows: 2,
                }),
            ]}
            plantNames={[{ id: 42, name: 'Tikvica' }]}
        />,
    );

    await page.locator('[data-advanced-sowing-details-trigger]').click();
    await page.getByRole('button', { name: 'Označi kao uklonjena' }).click();
    expect(capture.getRequestCount()).toBe(0);
    const confirmation = page.getByRole('alertdialog', {
        name: 'Potvrda promjene stanja',
    });
    await expect(
        confirmation.getByText('Promjena vrijedi za sva pripadajuća polja.', {
            exact: false,
        }),
    ).toBeVisible();
    expect(capture.getRequestCount()).toBe(0);
    await confirmation
        .getByRole('button', { name: 'Promijeni stanje' })
        .click();

    const request = await capture.requestPromise;
    expect(request.method).toBe('PATCH');
    expectCommandIdentity(request.payload, 333);
    expect(request.payload).toEqual(
        expect.objectContaining({ status: 'removed' }),
    );
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
            plantNames={[{ id: 42, name: 'Bosiljak' }]}
        />,
    );

    await page.locator('[data-advanced-sowing-details-trigger]').click();
    await expect(page.getByText('Čeka provjeru sijanja')).toBeVisible();
    await expect(
        page.locator('[data-selected-planting-lifecycle-actions="true"]'),
    ).toHaveCount(0);
    await expect(
        page.locator('[data-selected-planting-reschedule="true"]'),
    ).toHaveCount(0);
    await expect(
        page.getByText(
            'Status biljke moći ćeš mijenjati nakon što sijanje bude dovršeno i provjereno.',
        ),
    ).toBeVisible();
});
