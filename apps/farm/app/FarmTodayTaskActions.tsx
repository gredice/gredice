import type { FarmTodayTask } from './farmTodayModel';
import { CompleteOperationModal } from './schedule/CompleteOperationModal';
import { CompletePlantingModal } from './schedule/CompletePlantingModal';
import { ScheduleTaskBlockerModal } from './schedule/ScheduleTaskBlockerModal';
import { ScheduleTaskStateControl } from './schedule/ScheduleTaskStateControl';

export type FarmTodayTaskActionContext = {
    accountId: string;
    sessionIncarnation: string;
    userId: string;
};

type FarmTodayTaskActionsProps = {
    context: FarmTodayTaskActionContext;
    task: FarmTodayTask;
};

export function FarmTodayTaskActions({
    context,
    task,
}: FarmTodayTaskActionsProps) {
    if (task.kind === 'operation') {
        const completionAction =
            task.actionTarget && task.operationDefinitionAvailable ? (
                <CompleteOperationModal
                    accountId={context.accountId}
                    conditions={task.completionConditions}
                    expectedEntityId={task.actionTarget.expectedEntityId}
                    expectedTaskVersionEventId={
                        task.actionTarget.expectedTaskVersionEventId
                    }
                    label={task.label}
                    operationId={task.actionTarget.operationId}
                    sessionIncarnation={context.sessionIncarnation}
                    userId={context.userId}
                />
            ) : undefined;
        const blockerAction = task.actionTarget ? (
            <ScheduleTaskBlockerModal
                label={task.label}
                target={task.actionTarget}
            />
        ) : undefined;

        return (
            <ScheduleTaskStateControl
                action={completionAction}
                actionLabel="Dovrši radnju"
                blockerAction={blockerAction}
                label={task.label}
                layout="inline"
                state={task.state}
                unavailableTitle={
                    task.actionTarget
                        ? 'Radnja se ne može dovršiti dok zahtjevi za dovršetak nisu dostupni.'
                        : 'Radnja se ne može dovršiti dok podaci zadatka nisu dostupni.'
                }
            />
        );
    }

    const completionAction = task.actionTarget ? (
        <CompletePlantingModal
            expectedPlantCycleEventId={
                task.actionTarget.expectedPlantCycleEventId
            }
            expectedPlantCycleVersionEventId={
                task.actionTarget.expectedPlantCycleVersionEventId
            }
            expectedPlantSortId={task.actionTarget.expectedPlantSortId}
            label={task.label}
            positionIndex={task.actionTarget.positionIndex}
            raisedBedId={task.actionTarget.raisedBedId}
        />
    ) : undefined;
    const blockerAction = task.actionTarget ? (
        <ScheduleTaskBlockerModal
            label={task.label}
            target={task.actionTarget}
        />
    ) : undefined;

    return (
        <ScheduleTaskStateControl
            action={completionAction}
            actionLabel="Dovrši sijanje"
            blockerAction={blockerAction}
            label={task.label}
            layout="inline"
            state={task.state}
            unavailableTitle="Sijanje se ne može dovršiti dok podaci zadatka nisu dostupni."
        />
    );
}
