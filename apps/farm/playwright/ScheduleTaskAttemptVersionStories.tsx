'use client';

import type { ComponentProps } from 'react';
import { CompleteOperationModal as CompleteOperationModalComponent } from '../app/schedule/CompleteOperationModal';
import { CompletePlantingModal as CompletePlantingModalComponent } from '../app/schedule/CompletePlantingModal';
import { ScheduleTaskBlockerModal as ScheduleTaskBlockerModalComponent } from '../app/schedule/ScheduleTaskBlockerModal';

export const expectedTaskVersionEventId = 81;
export const expectedPlantCycleVersionEventId = 802;

export function CompleteOperationModalAttemptStory(
    props: Omit<
        ComponentProps<typeof CompleteOperationModalComponent>,
        | 'accountId'
        | 'expectedTaskVersionEventId'
        | 'sessionIncarnation'
        | 'userId'
    >,
) {
    return (
        <CompleteOperationModalComponent
            accountId="account-test"
            expectedTaskVersionEventId={expectedTaskVersionEventId}
            sessionIncarnation="session-test"
            userId="user-test"
            {...props}
        />
    );
}

export function CompletePlantingModalAttemptStory(
    props: Omit<
        ComponentProps<typeof CompletePlantingModalComponent>,
        'expectedPlantCycleVersionEventId'
    >,
) {
    return (
        <CompletePlantingModalComponent
            expectedPlantCycleVersionEventId={expectedPlantCycleVersionEventId}
            {...props}
        />
    );
}

type ScheduleTaskBlockerModalTarget = ComponentProps<
    typeof ScheduleTaskBlockerModalComponent
>['target'];
type TestScheduleTaskBlockerModalTarget =
    ScheduleTaskBlockerModalTarget extends infer Target
        ? Target extends { kind: 'operation' }
            ? Omit<Target, 'expectedTaskVersionEventId'>
            : Target extends { kind: 'planting' }
              ? Omit<Target, 'expectedPlantCycleVersionEventId'>
              : never
        : never;

export function ScheduleTaskBlockerModalAttemptStory({
    target,
    ...props
}: Omit<ComponentProps<typeof ScheduleTaskBlockerModalComponent>, 'target'> & {
    target: TestScheduleTaskBlockerModalTarget;
}) {
    const versionedTarget: ScheduleTaskBlockerModalTarget =
        target.kind === 'operation'
            ? { ...target, expectedTaskVersionEventId }
            : { ...target, expectedPlantCycleVersionEventId };

    return (
        <ScheduleTaskBlockerModalComponent
            {...props}
            target={versionedTarget}
        />
    );
}
