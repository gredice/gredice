import { ScheduleActionProgress } from '../app/admin/schedule/ScheduleActionProgress';
import { scheduleTaskVersionChange } from '../app/admin/schedule/scheduleActionQueue';
import { useOptimisticScheduleActions } from '../app/admin/schedule/useOptimisticScheduleActions';

export function ScheduleActionsHarness() {
    const { getOperationPatch, runOptimisticAction } =
        useOptimisticScheduleActions();
    return (
        <div className="bg-background p-4 text-foreground">
            <ScheduleActionProgress />
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
                                    action: async (getVersion) => {
                                        const expectedVersion = getVersion(
                                            `operation:${id}`,
                                            10,
                                        );
                                        const response = await fetch(
                                            '/schedule-test-action',
                                            {
                                                method: 'POST',
                                                body: JSON.stringify({
                                                    id,
                                                    status,
                                                    expectedVersion,
                                                }),
                                            },
                                        );
                                        const result = await response.json();
                                        return result.success
                                            ? {
                                                  ...result,
                                                  ...scheduleTaskVersionChange(
                                                      `operation:${id}`,
                                                      expectedVersion,
                                                      expectedVersion + 1,
                                                  ),
                                              }
                                            : result;
                                    },
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
