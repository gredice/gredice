import type { EntityStandardized } from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
import { expect, test } from '@playwright/experimental-ct-react';
import type { Locator } from '@playwright/test';
import '../globals.css';
import {
    type FarmOperationCardData,
    FarmScheduleOperationTaskCard,
} from './FarmScheduleOperationTaskCard';
import { FarmSchedulePlantingTaskCard } from './FarmSchedulePlantingTaskCard';

const scheduledDate = new Date('2026-07-15T08:00:00.000Z');
const assignedUserByFieldIdPromise = Promise.resolve(new Map());

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
    };
}

function buildOperationDefinition(id: number): EntityStandardized {
    return {
        id,
        attributes: { duration: 15 },
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
                plantSort={undefined}
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
            userId="farmer-1"
        />,
    );

    const detailsLink = component.getByRole('link', {
        name: /Otvori upute/,
    });
    const completionButton = component.getByRole('button', {
        name: 'Dovrši radnju',
    });
    await expect(detailsLink.getByRole('button')).toHaveCount(0);
    await detailsLink.focus();
    await page.keyboard.press('Tab');
    await expect(completionButton).toBeFocused();
    await assertCardsStayWithinViewport(component);
    await assertPrimaryTargetsAreTouchable(component);
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
            userId="farmer-1"
        />,
    );

    await expect(component.getByRole('link')).toHaveCount(0);
    await expect(
        component.getByText('Upute trenutno nisu dostupne.'),
    ).toBeVisible();
    await expect(
        component.getByRole('button', { name: 'Dovrši radnju' }),
    ).toBeVisible();
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
            plantSort={undefined}
            userId="farmer-1"
            assignedUserByFieldIdPromise={assignedUserByFieldIdPromise}
        />,
    );

    const completionButton = component.getByRole('button');
    await expect(completionButton).toBeDisabled();
    await expect(completionButton).toHaveAttribute('aria-busy', 'true');
    await assertCardsStayWithinViewport(component);
    await assertPrimaryTargetsAreTouchable(component);
});

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
                    userId="farmer-1"
                />
                <FarmScheduleOperationTaskCard
                    completionAction={completionAction('Dovrši radnju')}
                    operation={buildOperation(3, 'planned', 'Zalij salatu')}
                    operationData={buildOperationDefinition(1003)}
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
        ).toHaveAttribute('href', '/operations/1001');
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
        ).toHaveAttribute('href', '/operations/1002');

        const actionableCard = component.locator(
            '[data-task-state="actionable"]',
        );
        await expect(
            actionableCard.getByRole('button', { name: 'Dovrši radnju' }),
        ).toBeVisible();
        await expect(
            actionableCard.getByRole('link', { name: /Otvori upute/ }),
        ).toHaveAttribute('href', '/operations/1003');
        await expect(
            actionableCard
                .getByRole('link', { name: /Otvori upute/ })
                .getByRole('button'),
        ).toHaveCount(0);

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
                    plantSort={undefined}
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
                    plantSort={undefined}
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
                    plantSort={undefined}
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
            pendingCard.getByRole('link', { name: /Otvori gredicu/ }),
        ).toHaveAttribute('href', '/raised-beds/10');
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
            completedCard.getByRole('link', { name: /Otvori gredicu/ }),
        ).toHaveAttribute('href', '/raised-beds/10');

        const actionableCard = component.locator(
            '[data-task-state="actionable"]',
        );
        await expect(
            actionableCard.getByRole('button', { name: 'Dovrši sijanje' }),
        ).toBeVisible();
        await expect(
            actionableCard.getByRole('link', { name: /Otvori gredicu/ }),
        ).toHaveAttribute('href', '/raised-beds/10');
        await expect(
            actionableCard
                .getByRole('link', { name: /Otvori gredicu/ })
                .getByRole('button'),
        ).toHaveCount(0);

        await assertCardsStayWithinViewport(component);
        await assertPrimaryTargetsAreTouchable(component);
    });
}
