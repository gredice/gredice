import { Card, CardOverflow } from '@gredice/ui/Card';
import { Stack } from '@gredice/ui/Stack';
import { auth } from '../../../lib/auth/auth';
import { getPendingAdminApprovalTasks } from '../../../src/approvalTasks';
import {
    approveApprovalRequestAction,
    approveScheduleOperationTaskAction,
    approveSchedulePlantingTaskAction,
    rejectApprovalRequestAction,
} from '../../(actions)/approvalActions';
import { ApprovalTaskList } from './ApprovalTaskList';

export const dynamic = 'force-dynamic';

export default async function AdminApprovalsPage() {
    await auth(['admin']);
    const tasks = await getPendingAdminApprovalTasks();
    const items = tasks.map((task) => {
        switch (task.kind) {
            case 'plantStatusRequest':
                return {
                    task,
                    approveAction: approveApprovalRequestAction.bind(
                        null,
                        task.requestId,
                    ),
                    rejectAction: rejectApprovalRequestAction.bind(
                        null,
                        task.requestId,
                    ),
                };
            case 'scheduleOperationVerification':
                return {
                    task,
                    approveAction: approveScheduleOperationTaskAction.bind(
                        null,
                        task.operationId,
                        task.expectedEntityId,
                        task.expectedTaskVersionEventId,
                    ),
                };
            case 'schedulePlantingVerification':
                return {
                    task,
                    approveAction: approveSchedulePlantingTaskAction.bind(
                        null,
                        task.raisedBedId,
                        task.positionIndex,
                        task.expectedPlantCycleEventId,
                        task.expectedPlantSortId,
                        task.expectedPlantCycleVersionEventId,
                    ),
                };
        }
        throw new Error('Nepoznata vrsta zahtjeva.');
    });

    return (
        <Stack spacing={4}>
            <Card>
                <CardOverflow>
                    <ApprovalTaskList items={items} />
                </CardOverflow>
            </Card>
        </Stack>
    );
}
