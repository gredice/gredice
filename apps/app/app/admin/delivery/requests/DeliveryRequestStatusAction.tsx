'use client';

import { Check, ShoppingCart, Truck, Undo } from '@gredice/ui/icons';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@gredice/ui/Menu';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { DeliveryRequestStatusChip } from '../components';
import { updateDeliveryRequestStatusAction } from './actions';
import { getNextDeliveryRequestStatus } from './DeliveryRequestStatusFlow';
import type { DeliveryRequestActionData } from './DeliveryRequestTypes';

type NextStatusAction = {
    status: string;
    label: string;
    icon: ReactNode;
};

function getNextStatusAction(state: string): NextStatusAction | undefined {
    const nextStatus = getNextDeliveryRequestStatus(state);

    switch (nextStatus) {
        case 'confirmed':
            return {
                status: 'confirmed',
                label: 'Potvrdi',
                icon: <Check className="size-4 shrink-0" />,
            };
        case 'preparing':
            return {
                status: 'preparing',
                label: 'U pripremi',
                icon: <ShoppingCart className="size-4 shrink-0" />,
            };
        case 'ready':
            return {
                status: 'ready',
                label: 'Spreman',
                icon: <Truck className="size-4 shrink-0" />,
            };
        case 'fulfilled':
            return {
                status: 'fulfilled',
                label: 'Ispunjen',
                icon: <Check className="size-4 shrink-0" />,
            };
    }

    if (state === 'cancelled') {
        return {
            status: 'confirmed',
            label: 'Vrati u potvrđeno',
            icon: <Undo className="size-4 shrink-0" />,
        };
    }

    return undefined;
}

export function DeliveryRequestStatusAction({
    request,
}: {
    request: DeliveryRequestActionData;
}) {
    const router = useRouter();
    const [loadingStatus, setLoadingStatus] = useState<string | null>(null);
    const nextAction = getNextStatusAction(request.state);

    async function updateStatus(status: string) {
        setLoadingStatus(status);

        try {
            const formData = new FormData();
            formData.set('requestId', request.id);
            formData.set('status', status);

            const result = await updateDeliveryRequestStatusAction(
                null,
                formData,
            );
            if (!result.success) {
                alert(result.message);
                return;
            }

            router.refresh();
        } finally {
            setLoadingStatus(null);
        }
    }

    if (!nextAction) {
        return <DeliveryRequestStatusChip status={request.state} size="sm" />;
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className="inline-flex appearance-none rounded-full bg-transparent p-0 text-left"
                    aria-label="Promijeni status zahtjeva"
                    disabled={loadingStatus !== null}
                >
                    <DeliveryRequestStatusChip
                        status={request.state}
                        size="sm"
                        disabled={loadingStatus !== null}
                        title="Promijeni status zahtjeva"
                    />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Sljedeći status</DropdownMenuLabel>
                <DropdownMenuItem
                    className="cursor-pointer"
                    disabled={loadingStatus !== null}
                    onClick={() => {
                        void updateStatus(nextAction.status);
                    }}
                    startDecorator={nextAction.icon}
                >
                    {loadingStatus === nextAction.status
                        ? 'Ažuriranje...'
                        : nextAction.label}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
