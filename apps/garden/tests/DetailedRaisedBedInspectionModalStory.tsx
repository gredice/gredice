import { useState } from 'react';
import { DetailedRaisedBedInspectionModal } from '../../../packages/game/src/hud/DetailedRaisedBedInspectionModal';

const reports = [
    {
        inspectedAt: '2026-08-10T08:30:00.000Z',
        notes: 'Tlo je rahlo i dovoljno vlažno.',
        notificationId: 'notification-1',
        operationId: 42,
        raisedBedId: 17,
        raisedBedName: 'Gredica Sjever',
    },
    {
        inspectedAt: '2026-08-10T08:35:00.000Z',
        notes: null,
        notificationId: 'notification-2',
        operationId: 43,
        raisedBedId: 18,
        raisedBedName: 'Gredica Jug',
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
