'use client';

import { Button } from '@gredice/ui/Button';
import { Navigate } from '@gredice/ui/icons';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { progressDeliveryRequestGroupStatusAction } from './actions';
import { getNextDeliveryRequestStatus } from './DeliveryRequestStatusFlow';
import type { DeliveryRequestActionData } from './DeliveryRequestTypes';

export function DeliveryRequestGroupStatusAction({
    requests,
}: {
    requests: DeliveryRequestActionData[];
}) {
    const router = useRouter();
    const [isPending, setIsPending] = useState(false);
    const actionableRequests = requests.filter((request) =>
        getNextDeliveryRequestStatus(request.state),
    );

    if (requests.length < 2 || actionableRequests.length === 0) {
        return null;
    }

    async function progressGroupStatus() {
        setIsPending(true);

        try {
            const formData = new FormData();
            for (const request of requests) {
                formData.append('requestIds', request.id);
            }

            const result = await progressDeliveryRequestGroupStatusAction(
                null,
                formData,
            );
            if (!result.success) {
                alert(result.message);
                return;
            }

            router.refresh();
        } finally {
            setIsPending(false);
        }
    }

    return (
        <Button
            type="button"
            variant="outlined"
            color="neutral"
            size="sm"
            loading={isPending}
            disabled={isPending}
            startDecorator={<Navigate className="size-4 shrink-0" />}
            title="Pomakni sve neotkazane zahtjeve u sljedeći status"
            onClick={() => {
                void progressGroupStatus();
            }}
        >
            Pomakni grupu
        </Button>
    );
}
