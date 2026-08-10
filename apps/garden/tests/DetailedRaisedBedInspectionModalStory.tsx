import { useState } from 'react';
import { DetailedRaisedBedInspectionModal } from '../../../packages/game/src/hud/DetailedRaisedBedInspectionModal';

const reports = [
    {
        assignedFarmer: {
            avatarUrl:
                'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="48" height="48"%3E%3Crect width="48" height="48" fill="%23166534"/%3E%3C/svg%3E',
            displayName: 'Ana Farmer',
        },
        inspectedAt: '2026-08-10T08:30:00.000Z',
        notes: 'Tlo je rahlo i dovoljno vlažno.',
        notificationId: 'notification-1',
        operationId: 42,
        raisedBedId: 17,
        raisedBedImageUrl:
            'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="48" height="48"%3E%3Crect width="48" height="48" fill="%2384cc16"/%3E%3C/svg%3E',
        raisedBedName: 'Gredica Sjever',
        raisedBedPhysicalId: '17',
    },
    {
        assignedFarmer: {
            avatarUrl: null,
            displayName: 'Ivan Marić',
        },
        inspectedAt: '2026-08-10T08:35:00.000Z',
        notes: null,
        notificationId: 'notification-2',
        operationId: 43,
        raisedBedId: 18,
        raisedBedImageUrl: null,
        raisedBedName: 'Gredica Jug',
        raisedBedPhysicalId: '18',
    },
];

export function DetailedRaisedBedInspectionModalStory({
    withDismissError = false,
}: {
    withDismissError?: boolean;
}) {
    const [open, setOpen] = useState(true);
    const [retryCount, setRetryCount] = useState(0);

    return (
        <div data-retry-count={retryCount} data-testid="inspection-modal-story">
            <DetailedRaisedBedInspectionModal
                dismissError={
                    withDismissError ? new Error('Dismissal unavailable') : null
                }
                dismissPending={false}
                onClose={() => setOpen(false)}
                onRetryDismiss={() => setRetryCount((count) => count + 1)}
                open={open}
                reports={reports}
            />
        </div>
    );
}
