import type { OperationTaskAdminValues } from '@gredice/storage/operationTaskAdministration';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { OperationTaskAdminEditModal } from '../app/admin/operations/OperationTaskAdminEditModal';

export function OperationTaskAdminEditHarness({
    status = 'completed',
    version = 42,
}: {
    status?: OperationTaskAdminValues['status'];
    version?: number;
}) {
    const date = '2026-09-29T08:15:30.123Z';
    return (
        <AppRouterContext.Provider
            value={{
                bfcacheId: 'admin-task-edit',
                back() {},
                forward() {},
                refresh() {
                    document.documentElement.dataset.adminTaskRefreshed =
                        'true';
                },
                push() {},
                replace() {},
                prefetch() {},
            }}
        >
            <OperationTaskAdminEditModal
                operationId={5479}
                taskVersionEventId={version}
                initialValues={{
                    entityId: 169,
                    status,
                    isAccepted: true,
                    assignedUserIds: ['vesna'],
                    timestamp: date,
                    createdAt: date,
                    assignedAt: date,
                    scheduledDate: date,
                    scheduledAt: date,
                    completedAt: ['completed', 'pendingVerification'].includes(
                        status,
                    )
                        ? date
                        : null,
                    verifiedAt: status === 'completed' ? date : null,
                    blockedAt: null,
                    canceledAt: null,
                    requestNote: '',
                    blockReasonCode: '',
                    blockReasonLabel: '',
                    blockNote: '',
                    error: '',
                    errorCode: '',
                    cancelReason: '',
                }}
                operationOptions={[
                    { id: 169, label: 'Branje zrelih plodova' },
                    { id: 170, label: 'Zalijevanje' },
                ]}
                assignableUsers={[
                    {
                        id: 'vesna',
                        userName: 'Vesna',
                        displayName: 'Vesna',
                        avatarUrl: null,
                    },
                    {
                        id: 'ivan',
                        userName: 'Ivan',
                        displayName: 'Ivan',
                        avatarUrl: null,
                    },
                ]}
            />
        </AppRouterContext.Provider>
    );
}
