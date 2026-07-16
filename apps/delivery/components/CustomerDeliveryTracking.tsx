import {
    deliveryRunExactLocationTtlMs,
    deliveryRunTrackingLiveThresholdMs,
} from '@gredice/storage/deliveryTrackingPolicy';
import { Alert } from '@gredice/ui/Alert';
import { MyLocation, Timer, Warning } from '@gredice/ui/icons';
import { useEffect, useState } from 'react';
import type { CustomerDeliveryTrackingSummary } from '../lib/deliveryDashboardTypes';
import { formatDeliveryDateTime } from '../lib/deliveryFormatting';
import { deliveryTrackingMapVersion } from '../lib/deliveryTrackingPresentation';
import { DeliveryMap } from './DeliveryMap';

export type CustomerDeliveryTrackingRequestTiming = {
    monotonicMs: number;
    wallMs: number;
};

function trackingMessage(tracking: CustomerDeliveryTrackingSummary) {
    const lastUpdate = tracking.lastAcceptedAt
        ? formatDeliveryDateTime(tracking.lastAcceptedAt)
        : null;
    switch (tracking.status) {
        case 'live':
            return lastUpdate
                ? `Lokacija vozača je uživo. Zadnje ažuriranje: ${lastUpdate}.`
                : 'Lokacija vozača je uživo.';
        case 'delayed':
            return lastUpdate
                ? `Lokacija vozača kasni. Zadnje potvrđeno ažuriranje: ${lastUpdate}.`
                : 'Lokacija vozača kasni.';
        case 'offline':
            return lastUpdate
                ? `Praćenje je trenutačno izvan mreže. Zadnje potvrđeno ažuriranje: ${lastUpdate}.`
                : 'Praćenje je trenutačno izvan mreže.';
        case 'unavailable':
            return 'Lokacija vozača još nije dostupna. Status dostave i procjena dolaska i dalje će se ažurirati.';
    }
}

function exactLocationRemainingMs(
    tracking: CustomerDeliveryTrackingSummary,
    requestTiming: CustomerDeliveryTrackingRequestTiming | null,
) {
    if (
        !tracking.mapAvailable ||
        !tracking.lastAcceptedAt ||
        tracking.exactLocationExpiresInMs === null ||
        !Number.isFinite(tracking.exactLocationExpiresInMs) ||
        tracking.exactLocationExpiresInMs < 0 ||
        !requestTiming ||
        !Number.isFinite(requestTiming.monotonicMs) ||
        !Number.isFinite(requestTiming.wallMs)
    ) {
        return null;
    }
    const monotonicElapsed = performance.now() - requestTiming.monotonicMs;
    const wallElapsed = Date.now() - requestTiming.wallMs;
    const elapsed = Math.max(0, monotonicElapsed, wallElapsed);
    return tracking.exactLocationExpiresInMs - elapsed;
}

type ClientTrackingPhase = 'delayed' | 'offline';

const delayedRemainingThresholdMs =
    deliveryRunExactLocationTtlMs - deliveryRunTrackingLiveThresholdMs;

function clientTrackingPhase(
    tracking: CustomerDeliveryTrackingSummary,
    remainingMs: number | null,
): ClientTrackingPhase | null {
    if (!tracking.mapAvailable) return null;
    if (remainingMs === null || remainingMs <= 0) return 'offline';
    if (
        tracking.status === 'live' &&
        remainingMs <= delayedRemainingThresholdMs
    ) {
        return 'delayed';
    }
    return null;
}

function useExactLocationAging(
    tracking: CustomerDeliveryTrackingSummary,
    requestTiming: CustomerDeliveryTrackingRequestTiming | null,
) {
    const [agedTracking, setAgedTracking] = useState<{
        acceptedAt: string;
        phase: ClientTrackingPhase;
    } | null>(() => {
        const phase = clientTrackingPhase(
            tracking,
            exactLocationRemainingMs(tracking, requestTiming),
        );
        return phase && tracking.lastAcceptedAt
            ? { acceptedAt: tracking.lastAcceptedAt, phase }
            : null;
    });
    const remainingMs = exactLocationRemainingMs(tracking, requestTiming);
    const calculatedPhase = clientTrackingPhase(tracking, remainingMs);
    const phase =
        calculatedPhase ??
        (tracking.lastAcceptedAt !== null &&
        agedTracking?.acceptedAt === tracking.lastAcceptedAt
            ? agedTracking.phase
            : null);

    useEffect(() => {
        if (!tracking.mapAvailable) {
            setAgedTracking(null);
            return;
        }
        let timeoutId: number | null = null;
        const updateAging = () => {
            if (timeoutId !== null) window.clearTimeout(timeoutId);
            const remaining = exactLocationRemainingMs(tracking, requestTiming);
            const nextPhase = clientTrackingPhase(tracking, remaining);
            if (nextPhase) {
                setAgedTracking((current) =>
                    current?.acceptedAt === tracking.lastAcceptedAt &&
                    current.phase === nextPhase
                        ? current
                        : tracking.lastAcceptedAt
                          ? {
                                acceptedAt: tracking.lastAcceptedAt,
                                phase: nextPhase,
                            }
                          : null,
                );
                if (nextPhase === 'delayed' && remaining !== null) {
                    timeoutId = window.setTimeout(
                        updateAging,
                        Math.max(1, remaining),
                    );
                }
                return;
            }
            setAgedTracking(null);
            if (remaining === null) return;
            const untilNextPhase =
                tracking.status === 'live'
                    ? remaining - delayedRemainingThresholdMs
                    : remaining;
            timeoutId = window.setTimeout(
                updateAging,
                Math.max(1, untilNextPhase),
            );
        };
        updateAging();
        window.addEventListener('focus', updateAging);
        window.addEventListener('pageshow', updateAging);
        document.addEventListener('visibilitychange', updateAging);
        return () => {
            if (timeoutId !== null) window.clearTimeout(timeoutId);
            window.removeEventListener('focus', updateAging);
            window.removeEventListener('pageshow', updateAging);
            document.removeEventListener('visibilitychange', updateAging);
        };
    }, [tracking, requestTiming]);

    return phase;
}

export function CustomerDeliveryTracking({
    mapPath,
    tracking,
    requestTiming,
}: {
    mapPath: string;
    tracking: CustomerDeliveryTrackingSummary;
    requestTiming: CustomerDeliveryTrackingRequestTiming | null;
}) {
    const clientPhase = useExactLocationAging(tracking, requestTiming);
    const visibleTracking: CustomerDeliveryTrackingSummary =
        clientPhase === 'offline'
            ? {
                  ...tracking,
                  status: 'offline',
                  mapAvailable: false,
                  exactLocationExpiresInMs: null,
              }
            : clientPhase === 'delayed'
              ? { ...tracking, status: 'delayed' }
              : tracking;
    const showMap =
        visibleTracking.mapAvailable &&
        (visibleTracking.status === 'live' ||
            visibleTracking.status === 'delayed');
    const delayed = visibleTracking.status === 'delayed';
    const offline = visibleTracking.status === 'offline';

    return (
        <section className="space-y-3">
            <Alert
                role="status"
                aria-live="polite"
                color={delayed || offline ? 'warning' : 'info'}
                startDecorator={
                    offline ? (
                        <Warning className="size-5" />
                    ) : delayed ? (
                        <Timer className="size-5" />
                    ) : (
                        <MyLocation className="size-5" />
                    )
                }
            >
                {trackingMessage(visibleTracking)}
            </Alert>
            {showMap ? (
                <DeliveryMap
                    mapUrl={mapPath}
                    version={deliveryTrackingMapVersion(visibleTracking)}
                    title={
                        visibleTracking.status === 'live'
                            ? 'Trenutna lokacija vozača i moja dostava'
                            : 'Posljednja potvrđena lokacija vozača i moja dostava'
                    }
                />
            ) : null}
        </section>
    );
}
