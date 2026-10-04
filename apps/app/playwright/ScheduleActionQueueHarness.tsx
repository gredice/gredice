import { OptimisticScheduleActionsProvider } from '../app/admin/schedule/useOptimisticScheduleActions';
import { ScheduleActionsHarness } from './ScheduleActionsHarness';

export function ScheduleActionQueueHarness() {
    return (
        <OptimisticScheduleActionsProvider>
            <ScheduleActionsHarness />
        </OptimisticScheduleActionsProvider>
    );
}
