import { ScheduleActionProgress } from '../app/admin/schedule/ScheduleActionProgress';
import {
    scheduleTaskVersionChange,
    settleScheduleActions,
} from '../app/admin/schedule/scheduleActionQueue';
import { useOptimisticScheduleActions } from '../app/admin/schedule/useOptimisticScheduleActions';

async function changeScheduleAction(
    id: number,
    status: string,
    getVersion: (key: string, expected: number) => number,
) {
    const expectedVersion = getVersion(`operation:${id}`, 10);
    const response = await fetch('/schedule-test-action', {
        method: 'POST',
        body: JSON.stringify({ id, status, expectedVersion }),
    });
    const result = await response.json();
    return result.success
        ? {
              ...result,
              ...scheduleTaskVersionChange(
                  `operation:${id}`,
                  expectedVersion,
                  result.taskVersionEventId ?? expectedVersion + 1,
              ),
          }
        : result;
}

export function ScheduleActionsHarness() {
    const { getOperationPatch, runOptimisticAction } =
        useOptimisticScheduleActions();
    return (
        <div className="bg-background p-4 text-foreground">
            <ScheduleActionProgress />
            <button
                type="button"
                onClick={() =>
                    runOptimisticAction({
                        operationPatches: [1, 2].map((id) => ({
                            id,
                            patch: { status: 'completed' },
                        })),
                        action: (getVersion) =>
                            settleScheduleActions(
                                [1, 2].map((id) =>
                                    changeScheduleAction(
                                        id,
                                        'completed',
                                        getVersion,
                                    ),
                                ),
                            ),
                        errorLogMessage: 'Bulk schedule action failed',
                        errorAlertMessage: 'Skupna promjena nije uspjela.',
                    })
                }
            >
                Complete both
            </button>
            {[1, 2].map((id) => (
                <div key={id}>
                    <span data-testid={`value-${id}`}>
                        {getOperationPatch(id)?.status ?? 'planned'}
                    </span>
                    {['completed', 'canceled'].map((status) => (
                        <button
                            key={status}
                            type="button"
                            onClick={() =>
                                runOptimisticAction({
                                    operationPatches: [
                                        { id, patch: { status } },
                                    ],
                                    action: (getVersion) =>
                                        changeScheduleAction(
                                            id,
                                            status,
                                            getVersion,
                                        ),
                                    errorLogMessage: 'Schedule action failed',
                                    errorAlertMessage: 'Promjena nije uspjela.',
                                })
                            }
                        >
                            {id}: {status}
                        </button>
                    ))}
                </div>
            ))}
        </div>
    );
}
