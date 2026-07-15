'use client';

import { DeliveryStopCard } from '../components/DeliveryStopCard';
import {
    customerFailedStop,
    deferredRetryStop,
    driverFailedStop,
    mixedStatusStop,
} from './deliveryRecoveryFixtures';

export function DeliveryStopCardStory() {
    return (
        <div className="max-w-2xl space-y-4 p-4">
            <DeliveryStopCard
                stop={mixedStatusStop}
                mode="driver"
                routeRevision={12}
                pendingAction={null}
                onArrive={() => undefined}
                onDeliver={() => undefined}
                onException={async () => ({ status: 'saved' })}
            />
            <DeliveryStopCard
                stop={deferredRetryStop}
                mode="driver"
                routeRevision={13}
                pendingAction={null}
                onRetry={() => undefined}
                onArrive={() => undefined}
                onDeliver={() => undefined}
                onException={async () => ({ status: 'saved' })}
            />
        </div>
    );
}

export function DeliveryCustomerStopCardStory() {
    return (
        <div className="max-w-2xl p-4">
            <DeliveryStopCard stop={customerFailedStop} mode="customer" />
        </div>
    );
}

export function DeliveryDriverTerminalStopCardStory() {
    return (
        <div className="max-w-2xl p-4">
            <DeliveryStopCard stop={driverFailedStop} mode="driver" />
        </div>
    );
}
