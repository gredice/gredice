import 'server-only';

import type {
    getAllOperations,
    getAllRaisedBeds,
    getApprovalRequests,
} from '@gredice/storage';
import { adminRequestRead } from './adminRequestReads';
import { countPendingPlantingTasks } from './approvalTaskEligibility';

export function createAdminApprovalData(loaders: {
    requests: () => ReturnType<typeof getApprovalRequests>;
    operations: () => ReturnType<typeof getAllOperations>;
    raisedBeds: () => ReturnType<typeof getAllRaisedBeds>;
}) {
    const getPendingApprovalData = adminRequestRead(
        'approvals.pending-data',
        async () => {
            const [pendingApprovalRequests, pendingOperations, raisedBeds] =
                await Promise.all([
                    loaders.requests(),
                    loaders.operations(),
                    loaders.raisedBeds(),
                ]);
            return { pendingApprovalRequests, pendingOperations, raisedBeds };
        },
    );

    const getPendingAdminApprovalTaskCount = adminRequestRead(
        'approvals.pending-count',
        async () => {
            const { pendingApprovalRequests, pendingOperations, raisedBeds } =
                await getPendingApprovalData();
            return (
                pendingApprovalRequests.length +
                pendingOperations.length +
                countPendingPlantingTasks(raisedBeds)
            );
        },
    );

    return { getPendingApprovalData, getPendingAdminApprovalTaskCount };
}
