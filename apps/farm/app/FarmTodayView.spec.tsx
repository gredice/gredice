import { expect, test } from '@playwright/experimental-ct-react';
import type { Locator } from '@playwright/test';
import {
    AppRouterContext,
    type AppRouterInstance,
} from 'next/dist/shared/lib/app-router-context.shared-runtime';
import './globals.css';
import { FarmTodayView } from './FarmTodayView';
import type {
    FarmTodayData,
    FarmTodayOperationTask,
    FarmTodayPlantingTask,
    FarmTodaySummary,
} from './farmTodayModel';

type AvailableFarmTodayData = Extract<FarmTodayData, { focusQueue: unknown }>;

const phoneViewports = [
    { width: 320, height: 568 },
    { width: 375, height: 667 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
] as const;

const nextNavigationRouter = {
    back: () => undefined,
    bfcacheId: 'farm-today-test',
    forward: () => undefined,
    prefetch: () => undefined,
    push: () => undefined,
    refresh: () => undefined,
    replace: () => undefined,
} satisfies AppRouterInstance;

function buildSummary(
    overrides: Partial<FarmTodaySummary> = {},
): FarmTodaySummary {
    return {
        assignedToMe: 0,
        completed: 0,
        countsComplete: true,
        overdue: 0,
        pendingVerification: 0,
        remaining: 0,
        remainingDuration: { complete: true, minutes: 0 },
        unassigned: 0,
        ...overrides,
    };
}

function buildOperationTask(
    overrides: Partial<FarmTodayOperationTask> = {},
): FarmTodayOperationTask {
    return {
        actionTarget: {
            expectedEntityId: 701,
            expectedTaskVersionEventId: 1701,
            kind: 'operation',
            operationId: 701,
        },
        ageIndicator: null,
        assignment: 'mine',
        durationMinutes: 20,
        href: '/operations/701',
        key: 'operation:701',
        kind: 'operation',
        label: 'Obreži rajčice',
        location: {
            farmId: 1,
            groupKey: 'A12|garden-1|account-1',
            kind: 'raisedBed',
            label: 'Gredica A12 · pozicija 3',
            physicalId: 'A12',
            positionIndex: 2,
            positionNumber: 3,
            raisedBedId: 12,
        },
        occurredAt: null,
        operationId: 701,
        operationDefinitionAvailable: true,
        overdue: false,
        proofRequirements: { images: 'none', notes: 'none' },
        scheduledDate: '2026-07-15T08:00:00.000Z',
        state: 'actionable',
        ...overrides,
    };
}

function buildPlantingTask(
    overrides: Partial<FarmTodayPlantingTask> = {},
): FarmTodayPlantingTask {
    return {
        actionTarget: {
            expectedPlantCycleEventId: 1801,
            expectedPlantCycleVersionEventId: 1802,
            expectedPlantSortId: 901,
            kind: 'planting',
            positionIndex: 6,
            raisedBedId: 81,
        },
        ageIndicator: null,
        assignment: 'mine',
        durationMinutes: 5,
        fieldId: 801,
        href: '/raised-beds/81',
        key: 'planting:801',
        kind: 'planting',
        label: 'Sijanje: Salata',
        location: {
            farmId: 1,
            groupKey: 'B4|garden-1|account-1',
            kind: 'raisedBed',
            label: 'Gredica B4 · pozicija 7',
            physicalId: 'B4',
            positionIndex: 6,
            positionNumber: 7,
            raisedBedId: 81,
        },
        occurredAt: null,
        overdue: false,
        plantSortId: 901,
        proofRequirements: { images: 'none', notes: 'none' },
        raisedBedId: 81,
        scheduledDate: '2026-07-15T09:00:00.000Z',
        state: 'actionable',
        ...overrides,
    };
}

function buildAvailableData(
    overrides: Partial<AvailableFarmTodayData> = {},
): AvailableFarmTodayData {
    return {
        attentionItems: [],
        dataIssues: [],
        dateKey: '2026-07-15',
        focusQueue: [],
        status: 'ready',
        summary: buildSummary(),
        workState: 'empty',
        ...overrides,
    };
}

const nextTask = buildOperationTask({
    ageIndicator: {
        label: 'Kasni 4 dana',
        level: 'critical',
        title: 'Zadatak kasni 4 dana.',
    },
    label: 'Obreži bočne izboje na visokim rajčicama sorte Volovsko srce prije večernjeg zalijevanja',
    location: {
        farmId: 1,
        groupKey: 'Sjeverna proizvodna zona 123456|garden-1|account-1',
        kind: 'raisedBed',
        label: 'Gredica Sjeverna proizvodna zona 123456 · pozicija 9',
        physicalId: 'Sjeverna proizvodna zona 123456',
        positionIndex: 8,
        positionNumber: 9,
        raisedBedId: 12,
    },
    overdue: true,
    proofRequirements: { images: 'required', notes: 'optional' },
});

const queuedTask = buildPlantingTask({
    assignment: 'shared',
    label: 'Sijanje u stakleniku: hrskava ljetna salata vrlo dugog naziva',
    location: {
        farmId: 1,
        groupKey: 'Južni tunel 81|garden-1|account-1',
        kind: 'greenhouse',
        label: 'Staklenik · Gredica Južni tunel 81 · pozicija 7',
        physicalId: 'Južni tunel 81',
        positionIndex: 6,
        positionNumber: 7,
        raisedBedId: 81,
    },
});

const pendingTask = buildOperationTask({
    assignment: 'shared',
    href: '/operations/702',
    key: 'operation:702',
    label: 'Pregledaj fotografije navodnjavanja i potvrdi završetak radnje',
    operationId: 702,
    proofRequirements: { images: 'unknown', notes: 'unknown' },
    state: 'pendingVerification',
});

const failedTask = buildOperationTask({
    href: '/operations/703',
    key: 'operation:703',
    label: 'Provjeri neuspjelo prihranjivanje rajčice',
    operationId: 703,
    state: 'failed',
});

const mixedReadyData = buildAvailableData({
    attentionItems: [
        { reasons: ['overdue'], task: nextTask },
        { reasons: ['unassigned'], task: queuedTask },
        {
            reasons: ['pendingVerification', 'unassigned'],
            task: pendingTask,
        },
        { reasons: ['failed'], task: failedTask },
    ],
    focusQueue: [nextTask, queuedTask],
    summary: buildSummary({
        assignedToMe: 1,
        overdue: 1,
        pendingVerification: 1,
        remaining: 2,
        remainingDuration: { complete: true, minutes: 25 },
        unassigned: 1,
    }),
    workState: 'hasWork',
});

function heading() {
    return (
        <h1 className="text-2xl font-semibold">
            Dobro jutro, Marija Magdalenić!
        </h1>
    );
}

function todayView(data: FarmTodayData) {
    return (
        <AppRouterContext.Provider value={nextNavigationRouter}>
            <FarmTodayView
                data={data}
                heading={heading()}
                taskActionContext={{
                    accountId: 'account-1',
                    sessionIncarnation: 'session-1',
                    userId: 'farmer-1',
                }}
                headerActions={
                    <>
                        <button
                            aria-label="Postavke"
                            className="size-11"
                            type="button"
                        >
                            P
                        </button>
                        <button
                            aria-label="Odjavi se"
                            className="size-11"
                            type="button"
                        >
                            O
                        </button>
                    </>
                }
            />
        </AppRouterContext.Provider>
    );
}

async function expectNoHorizontalOverflow(component: Locator) {
    expect(
        await component.evaluate((element) => {
            const bounds = element.getBoundingClientRect();
            return (
                bounds.left >= 0 &&
                bounds.right <= window.innerWidth &&
                element.scrollWidth <= element.clientWidth &&
                document.documentElement.scrollWidth <=
                    document.documentElement.clientWidth
            );
        }),
    ).toBe(true);
}

async function expectTouchTargets(component: Locator) {
    const targetSizes = await component
        .locator(
            'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]',
        )
        .evaluateAll((elements) =>
            elements
                .map((element) => ({
                    bounds: element.getBoundingClientRect(),
                    element,
                }))
                .filter(({ bounds }) => bounds.width > 0 && bounds.height > 0)
                .map(({ bounds, element }) => ({
                    description:
                        `${element.tagName.toLowerCase()} ${element.getAttribute('href') ?? ''} ${element.getAttribute('aria-label') ?? ''} ${element.textContent?.trim() ?? ''}`.trim(),
                    height: bounds.height,
                    width: bounds.width,
                })),
        );

    expect(targetSizes.length).toBeGreaterThan(0);
    for (const target of targetSizes) {
        expect(target.width, target.description).toBeGreaterThanOrEqual(44);
        expect(target.height, target.description).toBeGreaterThanOrEqual(44);
    }
}

for (const viewport of phoneViewports) {
    test(`keeps mixed Today work usable at ${viewport.width}x${viewport.height}`, async ({
        mount,
        page,
    }) => {
        await page.setViewportSize(viewport);
        const component = await mount(todayView(mixedReadyData));

        const nextTaskCard = component.locator(
            '[data-farm-today-task-card="operation:701"]',
        );
        await expect(nextTaskCard).toHaveCount(1);
        await expect(
            component.locator('[data-farm-today-task-card="planting:801"]'),
        ).toHaveCount(1);
        await expect(component.getByRole('heading', { level: 1 })).toHaveCount(
            1,
        );
        await expect(
            component.getByRole('region', {
                name: 'Sažetak današnjih zadataka',
            }),
        ).toBeVisible();
        await expect(
            component.getByRole('region', { name: 'Današnji zadaci' }),
        ).toBeVisible();
        await expect(
            component.getByRole('region', { name: 'Treba pažnju' }),
        ).toBeVisible();

        const nextTaskBounds = await nextTaskCard.boundingBox();
        expect(nextTaskBounds).not.toBeNull();
        if (!nextTaskBounds) {
            throw new Error('Expected the next-task card to render.');
        }
        expect(nextTaskBounds.y).toBeGreaterThanOrEqual(0);
        expect(nextTaskBounds.y + nextTaskBounds.height).toBeLessThanOrEqual(
            viewport.height,
        );

        await expect(
            nextTaskCard.getByRole('button', {
                name: `Dovrši radnju: ${nextTask.label}`,
            }),
        ).toBeVisible();
        await expect(
            nextTaskCard.getByRole('button', {
                name: `Ne mogu dovršiti radnju: ${nextTask.label}`,
            }),
        ).toBeVisible();
        await expect(component.getByRole('checkbox')).toHaveCount(0);

        await expect(component.getByText('Kasni 4 dana')).toBeVisible();
        await expect(component.getByText(nextTask.label)).toBeVisible();
        await expect(
            nextTaskCard.getByText('20 min', { exact: true }),
        ).toBeVisible();
        await expect(nextTaskCard.getByText('Pozicija 9')).toBeVisible();
        await expect(
            component.getByRole('heading', {
                name: /Gr Sjeverna proizvodna zona 123456/,
            }),
        ).toBeVisible();
        await expect(
            component.getByText('Dodijeljeno meni').first(),
        ).toBeVisible();
        await expect(component.getByText('Fotografija obavezna')).toBeVisible();
        await expect(component.getByText('Napomena po želji')).toBeVisible();
        await expect(component.getByText('Za napraviti')).toBeVisible();
        await expect(
            component.getByText('Nije dodijeljeno').first(),
        ).toBeVisible();
        await expect(component.getByText('Dokaz nije potreban')).toHaveCount(0);
        await expect(component.getByText('Otvori upute')).toHaveCount(0);
        await expect(component.getByText('Čeka potvrdu')).toBeVisible();
        await expect(
            component.getByText('Neuspjelo', { exact: true }),
        ).toBeVisible();
        await expect(
            component.getByText('Zahtjevi dokaza nisu dostupni'),
        ).toBeVisible();

        await expectNoHorizontalOverflow(component);
        await expectTouchTargets(component);
    });
}

test('opens the existing completion and blocker flows from Today', async ({
    mount,
    page,
}) => {
    const component = await mount(todayView(mixedReadyData));
    const nextTaskCard = component.locator(
        '[data-farm-today-task-card="operation:701"]',
    );

    await nextTaskCard
        .getByRole('button', { name: `Dovrši radnju: ${nextTask.label}` })
        .click();
    await expect(
        page.getByRole('dialog', { name: 'Potvrda završetka radnje' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Odustani' }).click();

    await nextTaskCard
        .getByRole('button', {
            name: `Ne mogu dovršiti radnju: ${nextTask.label}`,
        })
        .click();
    await expect(
        page.getByRole('dialog', { name: 'Prijavi prepreku' }),
    ).toBeVisible();
});

test('keeps a partial result actionable while explaining incomplete counts', async ({
    mount,
}) => {
    const data = buildAvailableData({
        dataIssues: ['pendingOperationsUnavailable'],
        focusQueue: [nextTask],
        status: 'partial',
        summary: buildSummary({
            assignedToMe: 1,
            countsComplete: false,
            overdue: 1,
            remaining: 1,
            remainingDuration: { complete: false, minutes: 20 },
        }),
        workState: 'hasWork',
    });
    const component = await mount(todayView(data));

    await expect(
        component.getByText('Prikazujemo dostupne podatke.'),
    ).toBeVisible();
    await expect(
        component.getByText(
            'Brojevi sa znakom ≥ najmanje su potvrđene vrijednosti.',
        ),
    ).toBeVisible();
    await expect(
        component.locator('[data-farm-today-task-card="operation:701"]'),
    ).toBeVisible();
    await expect(
        component.getByText('≥ 1', { exact: true }).first(),
    ).toBeVisible();
});

const availableStateCases = [
    {
        description: 'Danas nema planiranih zadataka',
        linkLabel: 'Otvori raspored',
        name: 'empty',
        summary: buildSummary(),
        workState: 'empty',
    },
    {
        description: 'Nema zadataka dodijeljenih tebi',
        linkLabel: 'Otvori cijeli raspored',
        name: 'noAssignedWork',
        summary: buildSummary(),
        workState: 'noAssignedWork',
    },
    {
        description: 'Današnji posao je gotov',
        linkLabel: 'Otvori raspored',
        name: 'allDone',
        summary: buildSummary({ completed: 3 }),
        workState: 'allDone',
    },
] as const;

for (const stateCase of availableStateCases) {
    test(`renders a meaningful ${stateCase.name} Today state`, async ({
        mount,
    }) => {
        const component = await mount(
            todayView(
                buildAvailableData({
                    summary: stateCase.summary,
                    workState: stateCase.workState,
                }),
            ),
        );

        await expect(
            component.getByRole('heading', {
                name: stateCase.description,
            }),
        ).toBeVisible();
        const scheduleLink = component.getByRole('link', {
            name: stateCase.linkLabel,
        });
        await expect(scheduleLink).toHaveAttribute(
            'href',
            '/schedule?date=2026-07-15',
        );
        await expectTouchTargets(component);
    });
}

test('renders a meaningful unavailable Today state', async ({ mount }) => {
    const data: FarmTodayData = {
        dataIssues: ['farmsUnavailable'],
        dateKey: '2026-07-15',
        status: 'unavailable',
    };
    const component = await mount(todayView(data));

    await expect(
        component.getByRole('heading', {
            name: 'Današnji zadaci se trenutno ne mogu učitati',
        }),
    ).toBeVisible();
    await expect(
        component.getByRole('button', { name: 'Pokušaj ponovno' }),
    ).toBeVisible();
    await expect(
        component.getByRole('link', { name: 'Otvori raspored' }),
    ).toHaveAttribute('href', '/schedule');
    await expectTouchTargets(component);
});

test('renders a meaningful no-farm state without a farm selector', async ({
    mount,
}) => {
    const data: FarmTodayData = {
        dataIssues: [],
        dateKey: '2026-07-15',
        status: 'noFarm',
    };
    const component = await mount(todayView(data));

    await expect(
        component.getByRole('heading', { name: 'Nemaš dodijeljenu farmu' }),
    ).toBeVisible();
    await expect(
        component.getByText('Odabir farme nije potreban za svakodnevni rad.', {
            exact: false,
        }),
    ).toBeVisible();
    await expect(
        component.getByRole('link', { name: 'Provjeri profil' }),
    ).toHaveAttribute('href', '/settings');
    await expect(component.getByRole('combobox')).toHaveCount(0);
    await expect(component.getByText('Moje farme')).toHaveCount(0);
    await expectTouchTargets(component);
});
