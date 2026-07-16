import type { EntityStandardized } from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
import { expect, test } from '@playwright/experimental-ct-react';
import type { Locator } from '@playwright/test';
import { ScheduleTaskReturnFocusHarness } from '../../playwright/ScheduleTaskReturnFocusHarness';
import '../globals.css';
import { CompleteOperationModal } from './CompleteOperationModal';
import {
    type FarmOperationCardData,
    FarmScheduleOperationTaskCard,
} from './FarmScheduleOperationTaskCard';
import { FarmSchedulePlantingTaskCard } from './FarmSchedulePlantingTaskCard';
import { ScheduleTaskReturnFocus } from './ScheduleTaskReturnFocus';

const scheduledDate = new Date('2026-07-15T08:00:00.000Z');
const blockedAt = new Date('2026-07-15T10:35:00.000Z');
const selectedDateKey = '2026-07-20';
const assignedUserByFieldIdPromise = Promise.resolve(new Map());
const plantSort = {
    id: 501,
    information: { name: 'Salata' },
} satisfies EntityStandardized;
const plantingIdentity = {
    expectedPlantCycleEventId: 801,
    expectedPlantCycleVersionEventId: 802,
    expectedPlantSortId: plantSort.id,
};

const operationLabels = {
    pending:
        'Vrlo duga radnja pripreme zemlje koja mora ostati čitljiva na uskom telefonu',
    completed:
        'Potvrđena radnja prihrane povrća s dovoljno dugim opisom za mali zaslon',
};

function buildOperation(
    id: number,
    status: FarmOperationCardData['status'],
    label: string,
): FarmOperationCardData {
    return {
        assignedUser: null,
        assignedUserId: null,
        assignedUserIds: [],
        completionNotes: undefined,
        durationMinutes: 15,
        entityId: id + 1000,
        id,
        imageUrls: undefined,
        label,
        scheduledDate,
        status,
        taskVersionEventId: id + 2000,
    };
}

function buildOperationDefinition(
    id: number,
    conditions?: EntityStandardized['conditions'],
): EntityStandardized {
    return {
        id,
        attributes: { duration: 15 },
        conditions,
        information: { label: `Radnja ${id}` },
    };
}

function completionAction(label: string, loading = false) {
    return (
        <Button
            aria-busy={loading}
            className="h-auto min-h-11 whitespace-normal py-2 [overflow-wrap:anywhere]"
            fullWidth
            loading={loading}
            size="lg"
            type="button"
        >
            {label}
        </Button>
    );
}

const plantingLabels = {
    pending:
        'Sijanje vrlo dugog naziva sorte rajčice koje mora ostati čitljivo na telefonu',
    completed:
        'Potvrđeno sijanje povrća s namjerno dugim opisom za uski mobilni zaslon',
};

async function assertCardsStayWithinViewport(component: Locator) {
    expect(
        await component.locator('[data-task-state]').evaluateAll((cards) =>
            cards.every((card) => {
                const bounds = card.getBoundingClientRect();
                return (
                    bounds.left >= 0 &&
                    bounds.right <= window.innerWidth &&
                    card.scrollWidth <= card.clientWidth
                );
            }),
        ),
    ).toBe(true);
}

async function assertPrimaryTargetsAreTouchable(component: Locator) {
    const undersizedTargets = await component
        .locator('a[href], button')
        .evaluateAll((targets) =>
            targets.flatMap((target) => {
                const bounds = target.getBoundingClientRect();
                if (bounds.width >= 44 && bounds.height >= 44) {
                    return [];
                }

                return [
                    {
                        height: bounds.height,
                        label:
                            target.getAttribute('aria-label') ??
                            target.textContent?.trim() ??
                            target.tagName,
                        width: bounds.width,
                    },
                ];
            }),
        );

    expect(undersizedTargets).toEqual([]);
}

async function assertTaskActionsAreFullWidth(card: Locator) {
    const actionArea = card.locator(
        '[data-schedule-task-completion="available"]',
    );
    const actionButtons = actionArea.getByRole('button');

    await expect(actionButtons).toHaveCount(2);
    expect(
        await actionArea.evaluate((area) => {
            const availableWidth = area.getBoundingClientRect().width;
            return Array.from(area.querySelectorAll('button')).every(
                (button) =>
                    Math.abs(
                        button.getBoundingClientRect().width - availableWidth,
                    ) <= 1,
            );
        }),
    ).toBe(true);
}

test('locks array-only work assigned to another farmer on a phone', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 720 });
    const component = await mount(
        <div className="space-y-2">
            <FarmScheduleOperationTaskCard
                completionAction={completionAction('Dovrši radnju')}
                operation={{
                    ...buildOperation(10, 'planned', 'Zalij salatu'),
                    assignedUserIds: ['farmer-2'],
                }}
                operationData={buildOperationDefinition(1010)}
                selectedDateKey={selectedDateKey}
                userId="farmer-1"
            />
            <FarmSchedulePlantingTaskCard
                completionAction={completionAction('Dovrši sijanje')}
                field={{
                    assignedUserId: null,
                    assignedUserIds: ['farmer-2'],
                    id: 10,
                    plantScheduledDate: scheduledDate,
                    plantStatus: 'planned',
                    positionIndex: 0,
                    raisedBedId: 10,
                    sowingLocation: 'direct',
                }}
                label="Posij salatu"
                plantSort={plantSort}
                plantingIdentity={plantingIdentity}
                selectedDateKey={selectedDateKey}
                userId="farmer-1"
                assignedUserByFieldIdPromise={assignedUserByFieldIdPromise}
            />
        </div>,
    );

    await expect(component.getByRole('link')).toHaveCount(2);
    await expect(component.getByRole('checkbox')).toHaveCount(0);
    const lockedButtons = component.getByRole('button');
    await expect(lockedButtons).toHaveCount(2);
    for (const button of await lockedButtons.all()) {
        await expect(button).toBeDisabled();
    }
    await expect(
        component.getByText('Radnja je dodijeljena drugom korisniku.'),
    ).toBeVisible();
    await expect(
        component.getByText('Sijanje je dodijeljeno drugom korisniku.'),
    ).toBeVisible();
    await assertCardsStayWithinViewport(component);
    await assertPrimaryTargetsAreTouchable(component);
});

test('keeps details before completion in keyboard order without nesting actions', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 720 });
    const component = await mount(
        <FarmScheduleOperationTaskCard
            completionAction={completionAction('Dovrši radnju')}
            operation={buildOperation(
                20,
                'planned',
                'Vrlo duga radnja koju farmer otvara prije završetka',
            )}
            operationData={buildOperationDefinition(1020)}
            selectedDateKey={selectedDateKey}
            userId="farmer-1"
        />,
    );

    const detailsLink = component.getByRole('link', {
        name: /Otvori upute/,
    });
    const completionButton = component.getByRole('button', {
        name: 'Dovrši radnju',
    });
    const blockerButton = component.getByRole('button', {
        name: /Ne mogu dovršiti radnju/,
    });
    await expect(detailsLink.getByRole('button')).toHaveCount(0);
    await detailsLink.focus();
    await page.keyboard.press('Tab');
    await expect(completionButton).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(blockerButton).toBeFocused();
    await assertTaskActionsAreFullWidth(component);
    await assertCardsStayWithinViewport(component);
    await assertPrimaryTargetsAreTouchable(component);
});

for (const width of [320, 375, 390, 430]) {
    test(`shows required and optional proof before completion at ${width}px`, async ({
        mount,
        page,
    }) => {
        await page.setViewportSize({ width, height: 720 });
        const operation = buildOperation(
            width,
            'planned',
            'Vrlo duga radnja s obaveznim dokazom završetka na telefonu',
        );
        const conditions = {
            completionAttachImagesRequired: true,
            completionAttachNotes: true,
        };
        const component = await mount(
            <FarmScheduleOperationTaskCard
                completionAction={
                    <CompleteOperationModal
                        conditions={conditions}
                        expectedEntityId={operation.entityId}
                        expectedTaskVersionEventId={
                            operation.taskVersionEventId
                        }
                        label={operation.label}
                        operationId={operation.id}
                    />
                }
                operation={operation}
                operationData={buildOperationDefinition(
                    operation.entityId,
                    conditions,
                )}
                selectedDateKey={selectedDateKey}
                userId="farmer-1"
            />,
        );

        const requirements = component.getByRole('note', {
            name: 'Zahtjevi dokaza završetka',
        });
        await expect(requirements.getByText('Dokaz završetka')).toBeVisible();
        await expect(
            requirements.getByText('Dodaj fotografiju (obavezno)'),
        ).toBeVisible();
        await expect(
            requirements.getByText('Dodaj napomenu (opcionalno)'),
        ).toBeVisible();
        const completionButton = component.getByRole('button', {
            name: /Dovrši radnju/,
        });
        await expect(completionButton).toHaveAttribute(
            'aria-describedby',
            `schedule-operation-${operation.id}-proof-requirements`,
        );
        await expect(completionButton).toHaveAccessibleDescription(
            /Dodaj fotografiju \(obavezno\).*Dodaj napomenu \(opcionalno\)/,
        );
        await assertCardsStayWithinViewport(component);
        await assertPrimaryTargetsAreTouchable(component);
    });
}

test('restores focus to the exact task and yields one logical keyboard focus', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await mount(
        <>
            <ScheduleTaskReturnFocus />
            <FarmScheduleOperationTaskCard
                completionAction={completionAction('Dovrši radnju')}
                operation={buildOperation(40, 'planned', 'Zalij salatu')}
                operationData={buildOperationDefinition(1040)}
                selectedDateKey={selectedDateKey}
                userId="farmer-1"
            />
        </>,
    );
    const task = page.locator('#schedule-task-operation-40');
    await expect(task).toHaveAccessibleName('Zalij salatu');
    await page.evaluate(() => {
        window.history.replaceState(null, '', '#schedule-task-operation-40');
        window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    await expect(task).toBeFocused();
    await expect(task).toHaveAttribute('data-schedule-task-restored', 'true');

    await page.keyboard.press('Tab');
    await expect(
        task.getByRole('link', { name: /Otvori upute/ }),
    ).toBeFocused();
    await expect(task).not.toHaveAttribute('data-schedule-task-restored');
});

test('waits beyond the initial settle window for a streamed task target', async ({
    mount,
    page,
}) => {
    await mount(
        <ScheduleTaskReturnFocusHarness
            delay={3000}
            id="schedule-task-operation-91"
        />,
    );
    await page.evaluate(() => {
        window.history.replaceState(null, '', '#schedule-task-operation-91');
        window.dispatchEvent(new HashChangeEvent('hashchange'));
    });

    const target = page.getByRole('article', { name: 'Odgođeni zadatak' });
    await expect(target).toBeFocused({ timeout: 6000 });
    await expect(target).toHaveAttribute('data-schedule-task-restored', 'true');
});

test('does not link unavailable operation guidance to a guaranteed 404', async ({
    mount,
}) => {
    const component = await mount(
        <FarmScheduleOperationTaskCard
            completionAction={completionAction('Dovrši radnju')}
            operation={buildOperation(
                22,
                'planned',
                'Radnja sa zastarjelim uputama',
            )}
            operationData={undefined}
            selectedDateKey={selectedDateKey}
            userId="farmer-1"
        />,
    );

    await expect(component.getByRole('link')).toHaveCount(0);
    await expect(
        component.getByText('Upute za radnju trenutno nisu dostupne.'),
    ).toBeVisible();
    await expect(
        component.getByText('Zahtjevi za dovršetak trenutno nisu dostupni.'),
    ).toBeVisible();
    await expect(
        component.getByRole('button', { name: /Dovrši radnju/ }),
    ).toBeDisabled();
    await expect(
        component.getByRole('button', {
            name: 'Ne mogu dovršiti radnju: Radnja sa zastarjelim uputama',
        }),
    ).toBeEnabled();
    await expect(
        component.getByText(
            'Radnja se ne može dovršiti dok zahtjevi za dovršetak nisu dostupni.',
        ),
    ).toBeVisible();
});

test('uses the raised bed as a safe fallback when plant guidance is missing', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 720 });
    const component = await mount(
        <FarmSchedulePlantingTaskCard
            completionAction={completionAction('Dovrši sijanje')}
            field={{
                assignedUserId: null,
                assignedUserIds: [],
                id: 92,
                plantScheduledDate: scheduledDate,
                plantStatus: 'planned',
                positionIndex: 0,
                raisedBedId: 10,
                sowingLocation: 'direct',
            }}
            label="Posij nepoznatu sortu"
            plantSort={undefined}
            plantingIdentity={plantingIdentity}
            selectedDateKey={selectedDateKey}
            userId="farmer-1"
            assignedUserByFieldIdPromise={assignedUserByFieldIdPromise}
        />,
    );

    await expect(
        component.getByText('Upute za biljku trenutno nisu dostupne.'),
    ).toBeVisible();
    await expect(
        component.getByRole('link', { name: 'Otvori gredicu' }),
    ).toHaveAttribute('href', '/raised-beds/10');
    await expect(
        component.getByRole('link', { name: /Otvori upute za biljku/ }),
    ).toHaveCount(0);
    await assertCardsStayWithinViewport(component);
    await assertPrimaryTargetsAreTouchable(component);
});

test('does not expose planting mutations when the current task identity is unavailable', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 720 });
    const component = await mount(
        <FarmSchedulePlantingTaskCard
            completionAction={completionAction('Dovrši sijanje')}
            field={{
                assignedUserId: null,
                assignedUserIds: [],
                id: 93,
                plantScheduledDate: scheduledDate,
                plantStatus: 'planned',
                positionIndex: 0,
                raisedBedId: 10,
                sowingLocation: 'direct',
            }}
            label="Posij salatu"
            plantingIdentity={null}
            plantSort={plantSort}
            selectedDateKey={selectedDateKey}
            userId="farmer-1"
            assignedUserByFieldIdPromise={assignedUserByFieldIdPromise}
        />,
    );

    await expect(
        component.getByRole('button', { name: 'Dovrši sijanje' }),
    ).toBeDisabled();
    await expect(
        component.getByRole('button', { name: /Ne mogu dovršiti sijanje/ }),
    ).toHaveCount(0);
    await expect(
        component.getByText(
            'Sijanje se ne može dovršiti dok podaci zadatka nisu dostupni.',
        ),
    ).toBeVisible();
    await assertCardsStayWithinViewport(component);
    await assertPrimaryTargetsAreTouchable(component);
});

test('keeps loading completion explicit, disabled, and phone-sized', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 720 });
    const component = await mount(
        <FarmSchedulePlantingTaskCard
            completionAction={completionAction('Dovrši sijanje', true)}
            field={{
                assignedUserId: null,
                assignedUserIds: [],
                id: 21,
                plantScheduledDate: scheduledDate,
                plantStatus: 'planned',
                positionIndex: 0,
                raisedBedId: 10,
                sowingLocation: 'direct',
            }}
            label="Sijanje vrlo duge sorte povrća"
            plantSort={plantSort}
            plantingIdentity={plantingIdentity}
            selectedDateKey={selectedDateKey}
            userId="farmer-1"
            assignedUserByFieldIdPromise={assignedUserByFieldIdPromise}
        />,
    );

    const completionButton = component.getByRole('button', {
        name: 'Dovrši sijanje',
    });
    await expect(completionButton).toBeDisabled();
    await expect(completionButton).toHaveAttribute('aria-busy', 'true');
    await expect(
        component.getByRole('button', {
            name: /Ne mogu dovršiti sijanje/,
        }),
    ).toBeVisible();
    await assertTaskActionsAreFullWidth(component);
    await assertCardsStayWithinViewport(component);
    await assertPrimaryTargetsAreTouchable(component);
});

for (const width of [320, 375, 390, 430]) {
    test(`keeps blocked operation and planting tasks visibly unresolved at ${width}px`, async ({
        mount,
        page,
    }) => {
        await page.setViewportSize({ width, height: 720 });
        const operationLabel = 'Zalijevanje blokirano zbog opreme';
        const plantingLabel = 'Sijanje blokirano zbog lokacije';
        const component = await mount(
            <div className="space-y-2">
                <FarmScheduleOperationTaskCard
                    completionAction={completionAction('Dovrši radnju')}
                    operation={{
                        ...buildOperation(
                            width + 100,
                            'blocked',
                            operationLabel,
                        ),
                        blockedAt,
                        blockNote: 'Crijevo je oštećeno.',
                        blockReasonLabel: 'Nedostaje materijal ili alat',
                    }}
                    operationData={buildOperationDefinition(width + 1100)}
                    selectedDateKey={selectedDateKey}
                    userId="farmer-1"
                />
                <FarmSchedulePlantingTaskCard
                    completionAction={completionAction('Dovrši sijanje')}
                    field={{
                        assignedUserId: null,
                        assignedUserIds: [],
                        blockedAt,
                        blockNote: 'Pristup gredici je zatvoren.',
                        blockReasonLabel: 'Lokacija nije dostupna',
                        id: width + 200,
                        plantScheduledDate: scheduledDate,
                        plantStatus: 'blocked',
                        positionIndex: 0,
                        raisedBedId: width + 20,
                        sowingLocation: 'direct',
                    }}
                    label={plantingLabel}
                    plantSort={plantSort}
                    plantingIdentity={plantingIdentity}
                    selectedDateKey={selectedDateKey}
                    userId="farmer-1"
                    assignedUserByFieldIdPromise={assignedUserByFieldIdPromise}
                />
            </div>,
        );

        const operationCard = component.getByRole('article', {
            name: operationLabel,
        });
        const plantingCard = component.getByRole('article', {
            name: plantingLabel,
        });

        for (const card of [operationCard, plantingCard]) {
            await expect(
                card.getByText('Blokirano', { exact: true }),
            ).toBeVisible();
            await expect(
                card.getByText('Prijavljeno administratorima'),
            ).toBeVisible();
            await expect(card.locator('time')).toHaveAttribute(
                'datetime',
                blockedAt.toISOString(),
            );
            await expect(
                card.locator('[data-schedule-task-completion]'),
            ).toHaveCount(0);
            await expect(
                card.getByRole('button', {
                    name: /Dovrši|Ne mogu dovršiti/,
                }),
            ).toHaveCount(0);
        }

        await expect(
            operationCard.getByText('Nedostaje materijal ili alat'),
        ).toBeVisible();
        await expect(
            plantingCard.getByText('Lokacija nije dostupna'),
        ).toBeVisible();
        await expect(operationCard.getByText(operationLabel)).not.toHaveClass(
            /line-through/,
        );
        await expect(plantingCard.getByText(plantingLabel)).not.toHaveClass(
            /line-through/,
        );

        await assertCardsStayWithinViewport(component);
        await assertPrimaryTargetsAreTouchable(component);
    });
}

for (const width of [320, 375, 390, 430, 1280]) {
    test(`renders operation pending and verified states within ${width}px`, async ({
        mount,
        page,
    }) => {
        await page.setViewportSize({ width, height: 720 });
        const component = await mount(
            <div className="space-y-2">
                <FarmScheduleOperationTaskCard
                    completionAction={completionAction('Dovrši radnju')}
                    operation={buildOperation(
                        1,
                        'pendingVerification',
                        operationLabels.pending,
                    )}
                    operationData={buildOperationDefinition(1001)}
                    selectedDateKey={selectedDateKey}
                    userId="farmer-1"
                />
                <FarmScheduleOperationTaskCard
                    completionAction={completionAction('Dovrši radnju')}
                    operation={{
                        ...buildOperation(
                            2,
                            'completed',
                            operationLabels.completed,
                        ),
                        completionNotes:
                            'Fotografije i napomena potvrđuju završetak.',
                        imageUrls: [
                            'https://images.unsplash.com/photo-1416879595882-3373a0480b5b',
                        ],
                    }}
                    operationData={buildOperationDefinition(1002)}
                    selectedDateKey={selectedDateKey}
                    userId="farmer-1"
                />
                <FarmScheduleOperationTaskCard
                    completionAction={completionAction('Dovrši radnju')}
                    operation={buildOperation(3, 'planned', 'Zalij salatu')}
                    operationData={buildOperationDefinition(1003)}
                    selectedDateKey={selectedDateKey}
                    userId="farmer-1"
                />
            </div>,
        );

        const pendingCard = component.locator(
            '[data-task-state="pendingVerification"]',
        );
        await expect(
            pendingCard.getByText('Čeka potvrdu', { exact: true }),
        ).toBeVisible();
        await expect(pendingCard.getByRole('checkbox')).toHaveCount(0);
        await expect(pendingCard.getByRole('button')).toHaveCount(0);
        await expect(
            pendingCard.getByRole('link', { name: /Otvori upute/ }),
        ).toHaveAttribute(
            'href',
            '/operations/1001?scheduleDate=2026-07-20&scheduleTask=1',
        );
        await expect(
            pendingCard.getByText(operationLabels.pending),
        ).toBeVisible();

        const completedCard = component.locator(
            '[data-task-state="completed"]',
        );
        await expect(
            completedCard.getByText('Potvrđeno', { exact: true }),
        ).toBeVisible();
        await expect(completedCard.getByRole('checkbox')).toHaveCount(0);
        await expect(
            completedCard.getByRole('button', {
                name: 'Prikaži napomenu završetka',
            }),
        ).toBeVisible();
        await expect(
            completedCard.getByRole('button', {
                name: /Otvori galeriju u punoj veličini/,
            }),
        ).toBeVisible();
        await expect(
            completedCard.getByRole('link', { name: /Otvori upute/ }),
        ).toHaveAttribute(
            'href',
            '/operations/1002?scheduleDate=2026-07-20&scheduleTask=2',
        );

        const actionableCard = component.locator(
            '[data-task-state="actionable"]',
        );
        await expect(
            actionableCard.getByRole('button', { name: 'Dovrši radnju' }),
        ).toBeVisible();
        await expect(
            actionableCard.getByRole('button', {
                name: /Ne mogu dovršiti radnju/,
            }),
        ).toBeVisible();
        await expect(
            actionableCard.getByRole('link', { name: /Otvori upute/ }),
        ).toHaveAttribute(
            'href',
            '/operations/1003?scheduleDate=2026-07-20&scheduleTask=3',
        );
        await expect(
            actionableCard
                .getByRole('link', { name: /Otvori upute/ })
                .getByRole('button'),
        ).toHaveCount(0);
        await assertTaskActionsAreFullWidth(actionableCard);

        await assertCardsStayWithinViewport(component);
        await assertPrimaryTargetsAreTouchable(component);
    });

    test(`renders planting pending and verified states within ${width}px`, async ({
        mount,
        page,
    }) => {
        await page.setViewportSize({ width, height: 720 });
        const component = await mount(
            <div className="space-y-2">
                <FarmSchedulePlantingTaskCard
                    completionAction={completionAction('Dovrši sijanje')}
                    field={{
                        assignedUserId: null,
                        assignedUserIds: [],
                        id: 1,
                        plantScheduledDate: scheduledDate,
                        plantStatus: 'pendingVerification',
                        positionIndex: 0,
                        raisedBedId: 10,
                        sowingLocation: 'direct',
                    }}
                    label={plantingLabels.pending}
                    plantSort={plantSort}
                    plantingIdentity={plantingIdentity}
                    selectedDateKey={selectedDateKey}
                    userId="farmer-1"
                    assignedUserByFieldIdPromise={assignedUserByFieldIdPromise}
                />
                <FarmSchedulePlantingTaskCard
                    completionAction={completionAction('Dovrši sijanje')}
                    field={{
                        assignedUserId: null,
                        assignedUserIds: [],
                        id: 2,
                        plantScheduledDate: scheduledDate,
                        plantStatus: 'sowed',
                        positionIndex: 1,
                        raisedBedId: 10,
                        sowingLocation: 'direct',
                    }}
                    label={plantingLabels.completed}
                    plantSort={plantSort}
                    plantingIdentity={plantingIdentity}
                    selectedDateKey={selectedDateKey}
                    userId="farmer-1"
                    assignedUserByFieldIdPromise={assignedUserByFieldIdPromise}
                />
                <FarmSchedulePlantingTaskCard
                    completionAction={completionAction('Dovrši sijanje')}
                    field={{
                        assignedUserId: null,
                        assignedUserIds: [],
                        id: 3,
                        plantScheduledDate: scheduledDate,
                        plantStatus: 'planned',
                        positionIndex: 2,
                        raisedBedId: 10,
                        sowingLocation: 'direct',
                    }}
                    label="Posij salatu"
                    plantSort={plantSort}
                    plantingIdentity={plantingIdentity}
                    selectedDateKey={selectedDateKey}
                    userId="farmer-1"
                    assignedUserByFieldIdPromise={assignedUserByFieldIdPromise}
                />
            </div>,
        );

        const pendingCard = component.locator(
            '[data-task-state="pendingVerification"]',
        );
        await expect(
            pendingCard.getByText('Čeka potvrdu', { exact: true }),
        ).toBeVisible();
        await expect(pendingCard.getByRole('checkbox')).toHaveCount(0);
        await expect(pendingCard.getByRole('button')).toHaveCount(0);
        await expect(
            pendingCard.getByRole('link', {
                name: /Otvori upute za biljku/,
            }),
        ).toHaveAttribute(
            'href',
            '/plants/501?scheduleDate=2026-07-20&scheduleTask=1',
        );
        await expect(
            pendingCard.getByText(plantingLabels.pending),
        ).toBeVisible();

        const completedCard = component.locator(
            '[data-task-state="completed"]',
        );
        await expect(
            completedCard.getByText('Potvrđeno', { exact: true }),
        ).toBeVisible();
        await expect(completedCard.getByRole('checkbox')).toHaveCount(0);
        await expect(completedCard.getByRole('button')).toHaveCount(0);
        await expect(
            completedCard.getByRole('link', {
                name: /Otvori upute za biljku/,
            }),
        ).toHaveAttribute(
            'href',
            '/plants/501?scheduleDate=2026-07-20&scheduleTask=2',
        );

        const actionableCard = component.locator(
            '[data-task-state="actionable"]',
        );
        await expect(
            actionableCard.getByRole('button', { name: 'Dovrši sijanje' }),
        ).toBeVisible();
        await expect(
            actionableCard.getByRole('button', {
                name: /Ne mogu dovršiti sijanje/,
            }),
        ).toBeVisible();
        await expect(
            actionableCard.getByRole('link', {
                name: /Otvori upute za biljku/,
            }),
        ).toHaveAttribute(
            'href',
            '/plants/501?scheduleDate=2026-07-20&scheduleTask=3',
        );
        await expect(
            actionableCard
                .getByRole('link', { name: /Otvori upute za biljku/ })
                .getByRole('button'),
        ).toHaveCount(0);
        await assertTaskActionsAreFullWidth(actionableCard);

        await assertCardsStayWithinViewport(component);
        await assertPrimaryTargetsAreTouchable(component);
    });
}
