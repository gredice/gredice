import {
    type DeliveryActionQueueEntry,
    type DeliveryActionQueueSnapshot,
    deliveryActionPendingEntryForStop,
    deliveryActionAcknowledgementBlocksRoute as queueAcknowledgementBlocksRoute,
} from './deliveryActionQueue';
import type { DeliveryRouteStepSummary } from './deliveryDashboardTypes';

const changedRouteCodes = new Set([
    'active-run-not-found',
    'route-order',
    'route-revision-conflict',
    'run-driver-conflict',
]);

export function deliveryActionPermanentFailureMessage(
    errorCode: string | undefined,
    scope: 'global' | 'stop',
) {
    if (errorCode === 'completion-override-required') {
        return scope === 'global'
            ? 'Dostava traži razlog za nastavak bez potvrđenog dolaska ili pregleda uroda. Učitaj trenutačno stanje i ponovno potvrdi dostavu s razlogom.'
            : 'Učitaj stanje poslužitelja, zatim odaberi razlog za dostavu bez pune provjere i ponovno potvrdi dostavu.';
    }
    if (changedRouteCodes.has(errorCode ?? '')) {
        return scope === 'global'
            ? 'Ruta na poslužitelju se promijenila. Lokalna radnja i sve ovisne radnje ostaju blokirane.'
            : 'Poslužitelj ima noviju verziju rute.';
    }
    return scope === 'global'
        ? 'Poslužitelj nije prihvatio lokalnu radnju. Ona i sve ovisne radnje ostaju blokirane dok se ne učita trenutačno stanje.'
        : 'Poslužitelj nije prihvatio ovu radnju. Učitaj trenutačno stanje prije nastavka.';
}

export function deliveryActionLocallyCompletesStop(
    entry: DeliveryActionQueueEntry | undefined,
) {
    return (
        entry?.command.kind === 'deliver' &&
        !deliveryActionAcknowledgementBlocksRoute(entry) &&
        (entry.state === 'queued' ||
            entry.state === 'sending' ||
            entry.state === 'synced')
    );
}

export function deliveryActionAcknowledgementBlocksRoute(
    entry: DeliveryActionQueueEntry | undefined,
) {
    return queueAcknowledgementBlocksRoute(entry);
}

export function deliveryActionCompletionMessage(
    entry: DeliveryActionQueueEntry | undefined,
    canContinue = false,
) {
    const message =
        entry?.state === 'synced'
            ? 'Poslužitelj je potvrdio dostavu. Čeka se osvježeno stanje rute.'
            : 'Dostava je spremljena na uređaju i čeka potvrdu poslužitelja.';
    return canContinue
        ? `${message} Možeš nastaviti na sljedeću stanicu.`
        : message;
}

export function deliveryRouteStepsWithLocalActions(
    routeSteps: readonly DeliveryRouteStepSummary[],
    actionQueue: DeliveryActionQueueSnapshot | null,
): readonly DeliveryRouteStepSummary[] {
    const serverCurrentIndex = routeSteps.findIndex(
        (step) => step.actionState === 'current',
    );
    if (serverCurrentIndex < 0) return routeSteps;

    let localCurrentIndex = serverCurrentIndex;
    while (localCurrentIndex < routeSteps.length) {
        const step = routeSteps[localCurrentIndex];
        if (step?.kind !== 'delivery' || step.stop.id === null) break;
        const entry = deliveryActionPendingEntryForStop(
            actionQueue,
            step.stop.id,
        );
        if (!deliveryActionLocallyCompletesStop(entry)) break;
        localCurrentIndex += 1;
    }
    if (localCurrentIndex === serverCurrentIndex) return routeSteps;

    return routeSteps.map((step, index) => {
        if (index >= serverCurrentIndex && index < localCurrentIndex) {
            if (step.kind === 'pickup') {
                return {
                    ...step,
                    actionState: 'completed',
                    pickup: { ...step.pickup, isCurrent: false },
                };
            }
            return {
                ...step,
                actionState: 'completed',
                lockedReason: null,
                stop: { ...step.stop, isCurrent: false },
            };
        }
        if (index !== localCurrentIndex) return step;
        if (step.kind === 'pickup') {
            return {
                ...step,
                actionState: 'current',
                pickup: { ...step.pickup, isCurrent: true },
            };
        }
        return {
            ...step,
            actionState: 'current',
            lockedReason: null,
            stop: { ...step.stop, isCurrent: true },
        };
    });
}
