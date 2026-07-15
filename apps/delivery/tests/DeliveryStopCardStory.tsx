'use client';

import { useState } from 'react';
import { DeliveryStopCard } from '../components/DeliveryStopCard';
import type { DeliveryActionQueueEntry } from '../lib/deliveryActionQueue';
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

const pendingStop = {
    ...mixedStatusStop,
    stopState: 'pending',
    statusLabel: 'U dostavi',
    arrivedAt: null,
    deliveries: mixedStatusStop.deliveries.map((delivery) =>
        delivery.stopState === 'arrived'
            ? { ...delivery, stopState: 'pending' }
            : delivery,
    ),
};

function actionEntry({
    kind,
    state,
}: {
    kind: 'arrive' | 'deliver';
    state: DeliveryActionQueueEntry['state'];
}): DeliveryActionQueueEntry {
    return {
        sequence: 0,
        command: {
            kind,
            operationId: `${kind}-component`,
            runId: 'run-component-4127',
            stopId: 41,
            expectedRouteRevision: 12,
            occurredAt: '2026-07-15T08:31:00.000Z',
        },
        state,
        attemptCount: state === 'queued' ? 0 : 1,
        createdAt: '2026-07-15T08:31:00.000Z',
        updatedAt: '2026-07-15T08:31:00.000Z',
        ...(state === 'failed' ? { errorCode: 'offline' } : {}),
        ...(state === 'conflicted'
            ? { errorCode: 'route-revision-conflict' }
            : {}),
    };
}

export function DeliveryQueuedArrivalStory() {
    return (
        <div className="max-w-2xl p-4">
            <DeliveryStopCard
                stop={pendingStop}
                mode="driver"
                routeRevision={12}
                pendingAction={null}
                syncEntry={actionEntry({ kind: 'arrive', state: 'queued' })}
                verifiedTracePaths={['/trag/active-tomato-trace-0001']}
                onArrive={() => undefined}
                onDeliver={() => undefined}
                onException={async () => ({ status: 'saved' })}
            />
        </div>
    );
}

export function DeliveryFailedActionStory({
    state = 'failed',
}: {
    state?: 'failed' | 'conflicted';
}) {
    const [action, setAction] = useState('none');
    return (
        <div className="max-w-2xl p-4">
            <output data-testid="offline-action-result">{action}</output>
            <DeliveryStopCard
                stop={mixedStatusStop}
                mode="driver"
                routeRevision={12}
                pendingAction={null}
                syncEntry={actionEntry({ kind: 'deliver', state })}
                onArrive={() => undefined}
                onDeliver={() => undefined}
                onException={async () => ({ status: 'saved' })}
                onRetrySync={() => setAction('retried')}
                onDiscardSync={() => setAction('discarded')}
            />
        </div>
    );
}
