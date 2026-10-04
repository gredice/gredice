'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DeliveryTrackingFreshnessSummary } from '../lib/deliveryDashboardTypes';
import { assertDeliveryOfflineWritesAllowed } from '../lib/deliveryOfflineEvents';
import {
    classifyDriverLocationResponse,
    type DriverLocationAcknowledgement,
    type DriverLocationSample,
    DriverTrackingController,
    type DriverTrackingServerSeed,
    type DriverTrackingViewState,
    driverTrackingLiveThresholdMs,
    driverTrackingSampleTtlMs,
    driverTrackingUploadTimeoutMs,
    initialDriverTrackingViewState,
} from '../lib/driverTracking';

type UseDriverTrackingOptions = {
    runId: string | null;
    serverTracking: DeliveryTrackingFreshnessSummary | null;
    dashboardRefreshedAt: string | null;
    onDashboardRefresh?: () => void | Promise<void>;
};

type TrackingControls = {
    runId: string;
    reconcileServerSeed: (seed: DriverTrackingServerSeed) => void;
    recheckPermission: () => void;
    retryNow: () => void;
};

export type DriverTrackingState = DriverTrackingViewState & {
    retryNow: () => void;
    recheckPermission: () => void;
};

function createLocationSample(
    position: GeolocationPosition,
    nowMonotonicMs: number,
): DriverLocationSample | null {
    const { latitude, longitude, accuracy, heading, speed } = position.coords;
    if (
        !Number.isFinite(latitude) ||
        latitude < -90 ||
        latitude > 90 ||
        !Number.isFinite(longitude) ||
        longitude < -180 ||
        longitude > 180 ||
        !Number.isFinite(position.timestamp)
    ) {
        return null;
    }
    const observedAtWallMs = Date.now();
    const initialAgeMs = Math.max(0, observedAtWallMs - position.timestamp);
    const remainingTtlMs = Math.max(
        0,
        driverTrackingSampleTtlMs - initialAgeMs,
    );
    return {
        latitude,
        longitude,
        accuracy: Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : null,
        heading:
            heading !== null &&
            Number.isFinite(heading) &&
            heading >= 0 &&
            heading <= 360
                ? heading
                : null,
        speed:
            speed !== null && Number.isFinite(speed) && speed >= 0
                ? speed
                : null,
        recordedAt: new Date(position.timestamp).toISOString(),
        recordedAtMs: position.timestamp,
        observedAtMonotonicMs: nowMonotonicMs,
        expiresAtMonotonicMs: nowMonotonicMs + remainingTtlMs,
        observedAtWallMs,
        expiresAtWallMs: observedAtWallMs + remainingTtlMs,
    };
}

export function useDriverTracking({
    runId,
    serverTracking,
    dashboardRefreshedAt,
    onDashboardRefresh,
}: UseDriverTrackingOptions): DriverTrackingState {
    const [viewState, setViewState] = useState<DriverTrackingViewState>(
        initialDriverTrackingViewState,
    );
    const controlsRef = useRef<TrackingControls | null>(null);
    const refreshDashboardRef = useRef(onDashboardRefresh);
    const serverSeedRef = useRef<DriverTrackingServerSeed | null>(null);
    refreshDashboardRef.current = onDashboardRefresh;
    serverSeedRef.current =
        serverTracking && dashboardRefreshedAt
            ? { tracking: serverTracking, refreshedAt: dashboardRefreshedAt }
            : null;

    const retryNow = useCallback(() => {
        controlsRef.current?.retryNow();
    }, []);
    const recheckPermission = useCallback(() => {
        controlsRef.current?.recheckPermission();
    }, []);

    useEffect(() => {
        if (!runId) {
            controlsRef.current = null;
            setViewState(initialDriverTrackingViewState);
            return;
        }

        const controller = new DriverTrackingController();
        let disposed = false;
        let watchId: number | null = null;
        let permissionStatus: PermissionStatus | null = null;
        let timerId: ReturnType<typeof setTimeout> | null = null;
        let timerTargetMonotonicMs: number | null = null;
        let requestController: AbortController | null = null;
        let requestGeneration = 0;
        let networkOnline = navigator.onLine;
        let permissionAllowsUpload = true;
        let pendingPositionError:
            | 'position-timeout'
            | 'position-unavailable'
            | null = null;
        let state: DriverTrackingViewState = {
            ...initialDriverTrackingViewState,
            status: 'requesting',
        };
        setViewState(state);

        const publish = (patch: Partial<DriverTrackingViewState>) => {
            if (disposed) return;
            state = { ...state, ...patch };
            setViewState(state);
        };

        const requestDashboardRefresh = () => {
            try {
                const result = refreshDashboardRef.current?.();
                if (result) void result.catch(() => undefined);
            } catch {
                // The regular dashboard poll remains the fallback.
            }
        };

        const clearTimer = () => {
            if (timerId !== null) clearTimeout(timerId);
            timerId = null;
            timerTargetMonotonicMs = null;
        };

        const currentAcknowledgementStatus = () =>
            controller.acknowledgementStatus(performance.now(), Date.now()) ??
            'requesting';

        const refreshAcknowledgementFreshness = () => {
            if (state.status !== 'active' && state.status !== 'delayed') return;
            const status = currentAcknowledgementStatus();
            if (status === 'delayed' && pendingPositionError) {
                publish({
                    status: 'unavailable',
                    reason: pendingPositionError,
                });
                return;
            }
            if (status !== state.status) publish({ status });
        };

        const hasVisibleUnconfirmedFailure = () =>
            state.status === 'retrying' ||
            (state.status === 'unavailable' &&
                (state.reason === 'upload-rejected' ||
                    state.reason === 'server-rejected' ||
                    state.reason === 'sample-expired'));

        const scheduleTimerAt = (targetMonotonicMs: number) => {
            if (
                disposed ||
                (timerTargetMonotonicMs !== null &&
                    timerTargetMonotonicMs <= targetMonotonicMs)
            ) {
                return;
            }
            clearTimer();
            timerTargetMonotonicMs = targetMonotonicMs;
            timerId = setTimeout(
                () => {
                    timerId = null;
                    timerTargetMonotonicMs = null;
                    tick();
                },
                Math.max(0, targetMonotonicMs - performance.now()),
            );
        };

        const scheduleFreshnessCheck = () => {
            const acknowledgedAt = controller.acknowledgementMonotonicMs;
            if (acknowledgedAt === null || state.status !== 'active') return;
            scheduleTimerAt(acknowledgedAt + driverTrackingLiveThresholdMs + 1);
        };

        const publishExpiredSample = () => {
            if (state.status === 'denied') {
                publish({ nextRetryAt: null, sampleQueued: false });
                return;
            }
            publish({
                status: 'unavailable',
                nextRetryAt: null,
                sampleQueued: false,
                reason: 'sample-expired',
            });
        };

        const scheduleAttempt = (advance = false) => {
            if (disposed || !controller.hasPendingSample) return;
            if (controller.dropExpiredPending(performance.now(), Date.now())) {
                publishExpiredSample();
                return;
            }
            if (!permissionAllowsUpload) {
                const expiresAt = controller.pendingExpiresAtMonotonicMs;
                if (expiresAt !== null) scheduleTimerAt(expiresAt + 1);
                return;
            }
            if (!networkOnline) {
                clearTimer();
                publish({
                    status: 'retrying',
                    reason: 'offline',
                    nextRetryAt: null,
                    sampleQueued: controller.hasPendingSample,
                });
                const expiresAt = controller.pendingExpiresAtMonotonicMs;
                if (expiresAt !== null) scheduleTimerAt(expiresAt + 1);
                return;
            }
            const now = performance.now();
            const target = advance
                ? controller.advanceRetry(now)
                : controller.nextAttemptAt(now);
            if (target === null) return;
            scheduleTimerAt(target);
            const expiresAt = controller.pendingExpiresAtMonotonicMs;
            if (expiresAt !== null) scheduleTimerAt(expiresAt + 1);
            scheduleFreshnessCheck();
            publish({
                nextRetryAt: new Date(
                    Date.now() + Math.max(0, target - performance.now()),
                ).toISOString(),
                sampleQueued: controller.hasPendingSample,
            });
        };

        const abortCurrentRequest = () => {
            requestGeneration += 1;
            requestController?.abort();
            requestController = null;
        };

        const acknowledge = (
            acknowledgement: DriverLocationAcknowledgement,
            minimumInitialAgeMs: number,
        ) => {
            controller.acknowledge(
                acknowledgement,
                performance.now(),
                Date.now(),
                minimumInitialAgeMs,
            );
            publish({
                status: currentAcknowledgementStatus(),
                lastAcceptedAt: controller.lastAcceptedAt,
                nextRetryAt: null,
                retryAttempt: 0,
                sampleQueued: controller.hasPendingSample,
                reason: null,
            });
        };

        const attemptUpload = async () => {
            if (disposed || !networkOnline || !permissionAllowsUpload) return;
            const attemptStartedAtMonotonicMs = performance.now();
            const attemptStartedAtWallMs = Date.now();
            const attempt = controller.beginAttempt(
                attemptStartedAtMonotonicMs,
                attemptStartedAtWallMs,
            );
            if (attempt.kind === 'expired') {
                publishExpiredSample();
                return;
            }
            if (attempt.kind === 'wait') {
                scheduleTimerAt(attempt.eligibleAtMonotonicMs);
                scheduleFreshnessCheck();
                return;
            }
            if (attempt.kind !== 'send') {
                scheduleFreshnessCheck();
                return;
            }

            const retrying = controller.retryAttempt > 0;
            const visibleFailure = hasVisibleUnconfirmedFailure();
            const request = new AbortController();
            requestController = request;
            const currentRequestGeneration = ++requestGeneration;
            publish({
                status: visibleFailure
                    ? state.status
                    : retrying
                      ? 'retrying'
                      : controller.lastAcceptedAt
                        ? currentAcknowledgementStatus()
                        : 'sending',
                lastAttemptAt: new Date().toISOString(),
                nextRetryAt: null,
                sampleQueued: controller.hasPendingSample,
                reason: visibleFailure || retrying ? state.reason : null,
            });
            scheduleFreshnessCheck();

            let result: ReturnType<typeof classifyDriverLocationResponse>;
            const uploadTimeoutId = setTimeout(
                () => request.abort(),
                driverTrackingUploadTimeoutMs,
            );
            try {
                assertDeliveryOfflineWritesAllowed();
                const response = await fetch(
                    `/api/driver/runs/${runId}/location`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            latitude: attempt.sample.latitude,
                            longitude: attempt.sample.longitude,
                            accuracy: attempt.sample.accuracy,
                            heading: attempt.sample.heading,
                            speed: attempt.sample.speed,
                            recordedAt: attempt.sample.recordedAt,
                        }),
                        signal: request.signal,
                    },
                );
                const body: unknown = await response.json().catch(() => null);
                assertDeliveryOfflineWritesAllowed();
                result = classifyDriverLocationResponse({
                    status: response.status,
                    body,
                    retryAfter: response.headers.get('Retry-After'),
                });
            } catch {
                result = { kind: 'retry', retryAfterMs: null };
            } finally {
                clearTimeout(uploadTimeoutId);
            }

            if (disposed || currentRequestGeneration !== requestGeneration) {
                return;
            }
            requestController = null;

            if (result.kind === 'acknowledged') {
                acknowledge(
                    result.acknowledgement,
                    Math.max(
                        0,
                        performance.now() - attemptStartedAtMonotonicMs,
                        Date.now() - attemptStartedAtWallMs,
                    ),
                );
                if (
                    result.acknowledgement.status === 'offline' ||
                    result.acknowledgement.status === 'unavailable'
                ) {
                    requestDashboardRefresh();
                }
                if (controller.hasPendingSample) scheduleAttempt();
                else scheduleFreshnessCheck();
                return;
            }
            if (result.kind === 'retry') {
                const retry = controller.retryInFlight({
                    nowMonotonicMs: performance.now(),
                    retryAfterMs: result.retryAfterMs,
                    randomValue: Math.random(),
                });
                if (!retry) return;
                publish({
                    status: 'retrying',
                    retryAttempt: retry.retryAttempt,
                    sampleQueued: controller.hasPendingSample,
                    reason: networkOnline ? 'upload-failed' : 'offline',
                });
                scheduleAttempt();
                return;
            }

            if (result.kind === 'reconcile') {
                controller.reconcileInFlight();
                publish({
                    status: 'unavailable',
                    nextRetryAt: null,
                    retryAttempt: 0,
                    sampleQueued: controller.hasPendingSample,
                    reason: 'upload-rejected',
                });
                requestDashboardRefresh();
                if (controller.hasPendingSample) scheduleAttempt();
                return;
            }

            controller.rejectInFlight({
                acceptNewSample: result.acceptNewSample,
            });
            publish({
                status: 'unavailable',
                nextRetryAt: null,
                retryAttempt: 0,
                sampleQueued: controller.hasPendingSample,
                reason:
                    result.reason === 'server-rejected'
                        ? 'server-rejected'
                        : 'upload-rejected',
            });
            if (result.reason === 'server-rejected') {
                pendingPositionError = null;
                freshPositionGeneration += 1;
                freshPositionPending = false;
                stopWatch();
                requestDashboardRefresh();
            } else if (controller.hasPendingSample) {
                scheduleAttempt();
            }
        };

        function tick() {
            if (disposed) return;
            refreshAcknowledgementFreshness();
            if (controller.dropExpiredPending(performance.now(), Date.now())) {
                publishExpiredSample();
                scheduleFreshnessCheck();
                return;
            }
            if (controller.hasPendingSample) {
                void attemptUpload();
                return;
            }
            scheduleFreshnessCheck();
        }

        const stopWatch = () => {
            if (watchId !== null) navigator.geolocation.clearWatch(watchId);
            watchId = null;
        };

        const permissionDenied = () => {
            permissionAllowsUpload = false;
            pendingPositionError = null;
            freshPositionGeneration += 1;
            freshPositionPending = false;
            stopWatch();
            clearTimer();
            abortCurrentRequest();
            controller.blockAndDiscardExactSamples();
            publish({
                status: 'denied',
                nextRetryAt: null,
                retryAttempt: 0,
                sampleQueued: false,
                reason: 'permission-denied',
            });
        };

        const handlePosition = (position: GeolocationPosition) => {
            if (
                disposed ||
                !permissionAllowsUpload ||
                state.reason === 'server-rejected'
            ) {
                return;
            }
            const sample = createLocationSample(position, performance.now());
            if (!sample) {
                if (
                    state.status === 'retrying' ||
                    controller.hasPendingSample ||
                    controller.hasInFlightSample ||
                    controller.acknowledgementMonotonicMs !== null
                ) {
                    return;
                }
                publish({
                    status: 'unavailable',
                    reason: 'position-unavailable',
                });
                return;
            }
            pendingPositionError = null;
            if (controller.queueSample(sample)) {
                publish({ sampleQueued: true });
                scheduleAttempt();
            }
        };

        const handlePositionError = (error: GeolocationPositionError) => {
            if (
                disposed ||
                !permissionAllowsUpload ||
                state.reason === 'server-rejected'
            ) {
                return;
            }
            if (error.code === 1) {
                permissionDenied();
                return;
            }
            if (
                (state.status === 'retrying' && state.reason !== 'offline') ||
                controller.hasPendingSample ||
                controller.hasInFlightSample
            ) {
                return;
            }
            pendingPositionError =
                error.code === 3 ? 'position-timeout' : 'position-unavailable';
            if (
                controller.acknowledgementMonotonicMs !== null &&
                currentAcknowledgementStatus() === 'active'
            ) {
                scheduleFreshnessCheck();
                return;
            }
            publish({
                status: 'unavailable',
                nextRetryAt: null,
                reason: pendingPositionError,
            });
        };

        let freshPositionPending = false;
        let freshPositionGeneration = 0;
        const requestFreshPosition = () => {
            if (
                disposed ||
                freshPositionPending ||
                !permissionAllowsUpload ||
                !('geolocation' in navigator)
            ) {
                return;
            }
            freshPositionPending = true;
            const generation = ++freshPositionGeneration;
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    if (generation !== freshPositionGeneration) return;
                    freshPositionPending = false;
                    handlePosition(position);
                },
                (error) => {
                    if (generation !== freshPositionGeneration) return;
                    freshPositionPending = false;
                    handlePositionError(error);
                },
                {
                    enableHighAccuracy: true,
                    maximumAge: 0,
                    timeout: 20_000,
                },
            );
        };

        const startWatch = () => {
            if (
                disposed ||
                watchId !== null ||
                !permissionAllowsUpload ||
                state.reason === 'server-rejected' ||
                !('geolocation' in navigator)
            ) {
                return;
            }
            if (
                networkOnline &&
                controller.acknowledgementMonotonicMs === null
            ) {
                publish({ status: 'requesting', reason: null });
            }
            watchId = navigator.geolocation.watchPosition(
                handlePosition,
                handlePositionError,
                {
                    enableHighAccuracy: true,
                    maximumAge: 5_000,
                    timeout: 20_000,
                },
            );
        };

        const allowPermissionUploadsAndStartWatch = () => {
            controller.allowPermissionUploads();
            permissionAllowsUpload = true;
            startWatch();
        };

        const handlePermissionChange = () => {
            if (permissionStatus?.state === 'denied') {
                permissionDenied();
                return;
            }
            allowPermissionUploadsAndStartWatch();
            if (controller.hasPendingSample) scheduleAttempt(true);
        };

        const queryPermission = async () => {
            if (!navigator.permissions?.query) {
                allowPermissionUploadsAndStartWatch();
                return;
            }
            try {
                const status = await navigator.permissions.query({
                    name: 'geolocation',
                });
                if (disposed) return;
                permissionStatus?.removeEventListener(
                    'change',
                    handlePermissionChange,
                );
                permissionStatus = status;
                permissionStatus.addEventListener(
                    'change',
                    handlePermissionChange,
                );
                handlePermissionChange();
            } catch {
                allowPermissionUploadsAndStartWatch();
            }
        };

        const reconcileServerSeed = (seed: DriverTrackingServerSeed) => {
            const previousAcceptedAt = controller.lastAcceptedAt;
            const parsed = controller.reconcileServerSeed(
                seed,
                performance.now(),
                Date.now(),
            );
            if (!parsed) return;
            const strictlyNewerAcknowledgement =
                previousAcceptedAt === null ||
                Date.parse(parsed.acceptedAt) > Date.parse(previousAcceptedAt);
            const recoveringServerRejection =
                state.reason === 'server-rejected' &&
                strictlyNewerAcknowledgement;
            const permissionOverridesFreshness =
                state.status === 'denied' ||
                (state.status === 'unavailable' &&
                    state.reason === 'tracking-unsupported') ||
                (hasVisibleUnconfirmedFailure() &&
                    !strictlyNewerAcknowledgement);
            publish({
                ...(permissionOverridesFreshness
                    ? {}
                    : { status: parsed.status }),
                lastAcceptedAt: parsed.acceptedAt,
                ...(strictlyNewerAcknowledgement
                    ? { nextRetryAt: null, retryAttempt: 0 }
                    : {}),
                reason: permissionOverridesFreshness ? state.reason : null,
            });
            if (
                recoveringServerRejection &&
                permissionAllowsUpload &&
                'geolocation' in navigator
            ) {
                startWatch();
                if (controller.hasPendingSample) scheduleAttempt();
            }
            scheduleFreshnessCheck();
        };

        const advanceRetry = () => {
            if (disposed) return;
            if (state.reason === 'server-rejected') {
                requestDashboardRefresh();
                return;
            }
            refreshAcknowledgementFreshness();
            if (controller.hasPendingSample) scheduleAttempt(true);
            else requestFreshPosition();
        };
        const handleOnline = () => {
            networkOnline = true;
            if (state.reason === 'offline') {
                const queuedExactSample =
                    controller.hasPendingSample || controller.hasInFlightSample;
                publish({
                    status: queuedExactSample
                        ? 'retrying'
                        : (controller.acknowledgementStatus(
                              performance.now(),
                              Date.now(),
                          ) ?? 'requesting'),
                    reason: queuedExactSample ? 'upload-failed' : null,
                    nextRetryAt: null,
                    sampleQueued: controller.hasPendingSample,
                });
            }
            advanceRetry();
        };
        const handleOffline = () => {
            networkOnline = false;
            clearTimer();
            if (
                state.status === 'denied' ||
                state.reason === 'tracking-unsupported' ||
                state.reason === 'server-rejected'
            ) {
                return;
            }
            if (!controller.hasPendingSample && !controller.hasInFlightSample) {
                publish({
                    status: 'retrying',
                    nextRetryAt: null,
                    sampleQueued: false,
                    reason: 'offline',
                });
                return;
            }
            publish({
                status: 'retrying',
                nextRetryAt: null,
                sampleQueued: controller.hasPendingSample,
                reason: 'offline',
            });
            scheduleAttempt();
        };
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') advanceRetry();
        };

        const initialSeed = serverSeedRef.current;
        if (initialSeed) reconcileServerSeed(initialSeed);
        controlsRef.current = {
            runId,
            reconcileServerSeed,
            retryNow: advanceRetry,
            recheckPermission: () => {
                publish({ status: 'requesting', reason: null });
                void queryPermission();
            },
        };

        if (!('geolocation' in navigator)) {
            publish({
                status: 'unavailable',
                reason: 'tracking-unsupported',
            });
            return () => {
                disposed = true;
                if (controlsRef.current?.runId === runId) {
                    controlsRef.current = null;
                }
                controller.discard();
            };
        }

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        window.addEventListener('pageshow', advanceRetry);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        if (!networkOnline) handleOffline();
        void queryPermission();

        return () => {
            disposed = true;
            freshPositionGeneration += 1;
            freshPositionPending = false;
            if (controlsRef.current?.runId === runId) {
                controlsRef.current = null;
            }
            stopWatch();
            clearTimer();
            permissionStatus?.removeEventListener(
                'change',
                handlePermissionChange,
            );
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('pageshow', advanceRetry);
            document.removeEventListener(
                'visibilitychange',
                handleVisibilityChange,
            );
            abortCurrentRequest();
            controller.discard();
        };
    }, [runId]);

    useEffect(() => {
        if (!runId || !serverTracking || !dashboardRefreshedAt) return;
        const controls = controlsRef.current;
        if (controls?.runId !== runId) return;
        controls.reconcileServerSeed({
            tracking: serverTracking,
            refreshedAt: dashboardRefreshedAt,
        });
    }, [dashboardRefreshedAt, runId, serverTracking]);

    return {
        ...viewState,
        retryNow,
        recheckPermission,
    };
}
