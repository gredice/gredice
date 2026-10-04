'use client';

import {
    type DeliveryServerStateExpectation,
    useDeliveryActionSync,
} from '../hooks/useDeliveryActionSync';
import { useDeliveryHandoffSync } from '../hooks/useDeliveryHandoffSync';
import type { DriverRouteWakeLockState } from '../hooks/useDriverRouteWakeLock';
import type { DriverCommandResult } from '../lib/driverCommandResult';
import type { OfflineRouteSnapshot } from '../lib/offlineRouteCache';
import { DeliveryAppHeader } from './DeliveryAppHeader';
import { DriverRouteContinuity } from './DriverRouteContinuity';
import {
    OfflineRoutePanel,
    offlineDeliveryHandoffSelection,
} from './OfflineRoutePanel';

export function OfflineRouteRecovery({
    snapshot,
    authenticatedUserId,
    authenticatedRole,
    routeWakeLock,
    refreshServerState,
}: {
    snapshot: OfflineRouteSnapshot;
    authenticatedUserId: string;
    authenticatedRole: string;
    routeWakeLock: DriverRouteWakeLockState;
    refreshServerState: (
        expectation?: DeliveryServerStateExpectation,
    ) => Promise<boolean>;
}) {
    const sync = useDeliveryActionSync({
        userId: authenticatedUserId,
        runId: snapshot.scope.runId,
        refreshServerState,
    });
    const handoffSelection = offlineDeliveryHandoffSelection(
        snapshot,
        sync.snapshot,
    );
    const deliveryHandoffSync = useDeliveryHandoffSync({
        userId: authenticatedUserId,
        runId: snapshot.scope.runId,
        target: handoffSelection?.target ?? null,
        deliveries: handoffSelection?.deliveries ?? [],
        actionSync: sync,
    });
    const deliveryHandoff = handoffSelection
        ? {
              view: deliveryHandoffSync.handoff,
              feedback: deliveryHandoffSync.feedback,
              scan: deliveryHandoffSync.scan,
              markItem: deliveryHandoffSync.markItem,
              markRemainingReviewed: deliveryHandoffSync.markRemainingReviewed,
          }
        : null;

    const report = async (
        action: Promise<unknown>,
    ): Promise<DriverCommandResult> => {
        try {
            await action;
            return { status: 'saved' };
        } catch (cause) {
            const message =
                cause instanceof Error
                    ? cause.message
                    : 'Lokalnu radnju nije moguće sigurno spremiti.';
            return { status: 'failed', message };
        }
    };
    const requireRecovery = async (
        action: Promise<boolean>,
        message: string,
    ) => {
        const recovered = await action;
        if (!recovered) throw new Error(message);
    };

    return (
        <>
            <DeliveryAppHeader
                userId={authenticatedUserId}
                displayName="Izvanmrežna ruta"
                role={authenticatedRole}
            />
            <OfflineRoutePanel
                snapshot={snapshot}
                actionQueue={sync.snapshot}
                deliveryHandoff={deliveryHandoff}
                routeContinuity={
                    <DriverRouteContinuity
                        state={routeWakeLock}
                        trackingAvailable={false}
                    />
                }
                onArrive={(stopId, routeRevision) =>
                    report(sync.enqueueArrive(stopId, routeRevision))
                }
                onDeliver={(stopId, routeRevision, notes, completionOverride) =>
                    report(
                        sync.enqueueDelivery(
                            stopId,
                            routeRevision,
                            notes,
                            completionOverride,
                        ),
                    )
                }
                onException={async (stopId, mutation) => {
                    try {
                        await sync.enqueueException(stopId, mutation);
                        return { status: 'saved' };
                    } catch (cause) {
                        const message = sync.isBarrierError(cause)
                            ? 'Prethodna promjena još čeka usklađivanje. Učitaj trenutačno stanje prije novog problema.'
                            : 'Problem nije moguće sigurno spremiti na uređaj. Provjeri prostor i pokušaj ponovno.';
                        return sync.isBarrierError(cause)
                            ? { status: 'review-required', message }
                            : { status: 'retryable', message };
                    }
                }}
                onVerificationScan={(stopId, tracePath) => {
                    if (
                        !handoffSelection ||
                        handoffSelection.target.targetStopId !== stopId
                    ) {
                        return Promise.resolve({
                            status: 'failed' as const,
                            message:
                                'Aktivni posjet stanici promijenio se. Osvježi prikaz prije nove provjere.',
                        });
                    }
                    return report(
                        sync.enqueueVerificationScan(
                            stopId,
                            tracePath,
                            handoffSelection.target.retryAttempt,
                        ),
                    );
                }}
                onRetry={(operationId) => report(sync.retry(operationId))}
                onRecoverConflict={(operationId) =>
                    report(
                        requireRecovery(
                            sync.recoverConflict(operationId),
                            'Novo stanje rute nije moguće potvrditi. Lokalna radnja ostaje spremljena.',
                        ),
                    )
                }
                onReconcile={() =>
                    report(
                        requireRecovery(
                            sync.reconcilePendingServerState(),
                            'Novi plan rute još nije moguće potvrditi. Iznimka ostaje blokirajuća.',
                        ),
                    )
                }
            />
        </>
    );
}
