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
        completionNotes: undefined,
        durationMinutes: 15,
        id,
        imageUrls: undefined,
        label,
        scheduledDate,
        status,
    };
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

for (const width of [320, 390, 1280]) {
    test(`renders operation pending and verified states within ${width}px`, async ({
        mount,
        page,
    }) => {
        await page.setViewportSize({ width, height: 720 });
        const component = await mount(
            <div className="space-y-2">
                <FarmScheduleOperationTaskCard
                    completionAction={
                        <button type="button">Dovrši radnju</button>
                    }
                    operation={buildOperation(
                        1,
                        'pendingVerification',
                        operationLabels.pending,
                    )}
                    operationData={undefined}
                    userId="farmer-1"
                />
                <FarmScheduleOperationTaskCard
                    completionAction={
                        <button type="button">Dovrši radnju</button>
                    }
                    operation={buildOperation(
                        2,
                        'completed',
                        operationLabels.completed,
                    )}
                    operationData={undefined}
                    userId="farmer-1"
                />
                <FarmScheduleOperationTaskCard
                    completionAction={
                        <button type="button">Dovrši radnju</button>
                    }
                    operation={buildOperation(3, 'planned', 'Zalij salatu')}
                    operationData={undefined}
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
            pendingCard.getByText(operationLabels.pending),
        ).toBeVisible();

        const completedCard = component.locator(
            '[data-task-state="completed"]',
        );
        await expect(
            completedCard.getByText('Potvrđeno', { exact: true }),
        ).toBeVisible();
        const verifiedControl = completedCard.getByRole('checkbox', {
            name: `Potvrđeno: ${operationLabels.completed}`,
        });
        await expect(verifiedControl).toBeChecked();
        await expect(verifiedControl).toBeDisabled();

        const actionableCard = component.locator(
            '[data-task-state="actionable"]',
        );
        await expect(
            actionableCard.getByRole('button', { name: 'Dovrši radnju' }),
        ).toBeVisible();

        await assertCardsStayWithinViewport(component);
    });

    test(`renders planting pending and verified states within ${width}px`, async ({
        mount,
        page,
    }) => {
        await page.setViewportSize({ width, height: 720 });
        const component = await mount(
            <div className="space-y-2">
                <FarmSchedulePlantingTaskCard
                    completionAction={
                        <button type="button">Dovrši sijanje</button>
                    }
                    field={{
                        assignedUserId: null,
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
                    completionAction={
                        <button type="button">Dovrši sijanje</button>
                    }
                    field={{
                        assignedUserId: null,
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
                    completionAction={
                        <button type="button">Dovrši sijanje</button>
                    }
                    field={{
                        assignedUserId: null,
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
            pendingCard.getByText(plantingLabels.pending),
        ).toBeVisible();

        const completedCard = component.locator(
            '[data-task-state="completed"]',
        );
        await expect(
            completedCard.getByText('Potvrđeno', { exact: true }),
        ).toBeVisible();
        const verifiedControl = completedCard.getByRole('checkbox', {
            name: `Potvrđeno: ${plantingLabels.completed}`,
        });
        await expect(verifiedControl).toBeChecked();
        await expect(verifiedControl).toBeDisabled();

        const actionableCard = component.locator(
            '[data-task-state="actionable"]',
        );
        await expect(
            actionableCard.getByRole('button', { name: 'Dovrši sijanje' }),
        ).toBeVisible();

        await assertCardsStayWithinViewport(component);
    });
}
