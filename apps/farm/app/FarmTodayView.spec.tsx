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
    { width: 390, height: 844 },
    { width: 430, height: 932 },
] as const;

const nextNavigationRouter = {
    back: () => undefined,
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
        ageIndicator: null,
        assignment: 'mine',
        durationMinutes: 20,
        href: '/operations/701',
        key: 'operation:701',
        kind: 'operation',
        label: 'Obreži rajčice',
        location: {
            kind: 'raisedBed',
            label: 'Gredica A12 · pozicija 3',
            positionIndex: 2,
            raisedBedId: 12,
        },
        occurredAt: null,
        operationId: 701,
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
        ageIndicator: null,
        assignment: 'mine',
        durationMinutes: 5,
        fieldId: 801,
        href: '/raised-beds/81',
        key: 'planting:801',
        kind: 'planting',
        label: 'Sijanje: Salata',
        location: {
            kind: 'raisedBed',
            label: 'Gredica B4 · pozicija 7',
            positionIndex: 6,
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
        kind: 'raisedBed',
        label: 'Gredica Sjeverna proizvodna zona 123456 · pozicija 9',
        positionIndex: 8,
        raisedBedId: 12,
    },
    overdue: true,
    proofRequirements: { images: 'required', notes: 'optional' },
});

const queuedTask = buildPlantingTask({
    assignment: 'shared',
    label: 'Sijanje u stakleniku: hrskava ljetna salata vrlo dugog naziva',
    location: {
        kind: 'greenhouse',
        label: 'Staklenik · Gredica Južni tunel 81 · pozicija 7',
        positionIndex: 6,
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

        const nextTaskLink = component.locator('a[href="/operations/701"]');
        await expect(nextTaskLink).toHaveCount(1);
        await expect(
            component.locator('a[href="/raised-beds/81"]'),
        ).toHaveCount(1);
        expect(await nextTaskLink.evaluate((element) => element.tagName)).toBe(
            'A',
        );
        await expect(nextTaskLink).toHaveAttribute('href', '/operations/701');
        await expect(
            nextTaskLink.locator('[data-farm-today-task="operation:701"]'),
        ).toBeVisible();
        await expect(component.getByRole('heading', { level: 1 })).toHaveCount(
            1,
        );
        await expect(
            component.getByRole('region', {
                name: 'Sažetak današnjih zadataka',
            }),
        ).toBeVisible();
        await expect(
            component.getByRole('region', { name: 'Fokus' }),
        ).toBeVisible();
        await expect(
            component.getByRole('region', { name: 'Treba pažnju' }),
        ).toBeVisible();

        const nextTaskBounds = await nextTaskLink.boundingBox();
        expect(nextTaskBounds).not.toBeNull();
        if (!nextTaskBounds) {
            throw new Error('Expected the next-task card link to render.');
        }
        expect(nextTaskBounds.y).toBeGreaterThanOrEqual(0);
        expect(nextTaskBounds.y + nextTaskBounds.height).toBeLessThanOrEqual(
            viewport.height,
        );

        await expect(
            nextTaskLink.locator(
                'a, button, input, select, textarea, [role="button"], [role="checkbox"]',
            ),
        ).toHaveCount(0);
        await expect(
            component.getByText('Dovrši', { exact: false }),
        ).toHaveCount(0);
        await expect(component.getByRole('checkbox')).toHaveCount(0);

        await expect(component.getByText('Kasni 4 dana')).toBeVisible();
        await expect(component.getByText(nextTask.label)).toBeVisible();
        await expect(
            component.getByText(nextTask.location.label),
        ).toBeVisible();
        await expect(
            nextTaskLink.getByText('20 min', { exact: true }),
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
        await expect(
            component.getByText('Dokaz nije potreban').first(),
        ).toBeVisible();
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
    await expect(component.locator('a[href="/operations/701"]')).toBeVisible();
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
