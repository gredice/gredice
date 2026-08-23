import type {
    DeliveryTrackingFreshnessSummary,
    DeliveryTrackingStatus,
} from './deliveryDashboardTypes';

export const driverTrackingLiveThresholdMs = 30_000;
export const driverTrackingSampleTtlMs = 120_000;
export const driverTrackingMinimumAttemptIntervalMs = 10_000;
export const driverTrackingMaximumRetryDelayMs = 60_000;
export const driverTrackingUploadTimeoutMs = 20_000;

const driverTrackingInitialRetryDelayMs = 5_000;
const driverTrackingRetryJitterRatio = 0.2;

export type DriverTrackingReason =
    | 'offline'
    | 'permission-denied'
    | 'position-unavailable'
    | 'position-timeout'
    | 'tracking-unsupported'
    | 'upload-failed'
    | 'upload-rejected'
    | 'server-rejected'
    | 'sample-expired'
    | null;

export type DriverTrackingStatus =
    | 'inactive'
    | 'requesting'
    | 'sending'
    | 'active'
    | 'delayed'
    | 'retrying'
    | 'denied'
    | 'unavailable';

export type DriverTrackingViewState = {
    status: DriverTrackingStatus;
    lastAttemptAt: string | null;
    lastAcceptedAt: string | null;
    nextRetryAt: string | null;
    retryAttempt: number;
    sampleQueued: boolean;
    reason: DriverTrackingReason;
};

export type DriverLocationSample = {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    heading: number | null;
    speed: number | null;
    recordedAt: string;
    recordedAtMs: number;
    observedAtMonotonicMs: number;
    expiresAtMonotonicMs: number;
    observedAtWallMs: number;
    expiresAtWallMs: number;
};

export type DriverLocationAcknowledgement = {
    status: DeliveryTrackingStatus;
    acceptedAt: string;
    refreshedAt: string;
    replayed: boolean;
};

export type DriverLocationResponseResult =
    | {
          kind: 'acknowledged';
          acknowledgement: DriverLocationAcknowledgement;
      }
    | {
          kind: 'retry';
          retryAfterMs: number | null;
      }
    | { kind: 'reconcile' }
    | {
          kind: 'reject';
          acceptNewSample: boolean;
          reason: 'invalid-sample' | 'server-rejected';
      };

export type DriverTrackingServerSeed = {
    tracking: DeliveryTrackingFreshnessSummary;
    refreshedAt: string;
};

export type ParsedDriverTrackingServerSeed = {
    acceptedAt: string;
    acceptedAtMs: number;
    refreshedAtMs: number;
    ageAtRefreshMs: number;
    status: 'active' | 'delayed';
};

export type DriverTrackingAttemptResult =
    | { kind: 'none' }
    | { kind: 'blocked' }
    | { kind: 'expired' }
    | { kind: 'wait'; eligibleAtMonotonicMs: number }
    | { kind: 'send'; sample: DriverLocationSample };

export type DriverTrackingRetryResult = {
    retryAttempt: number;
    requestedDelayMs: number;
    eligibleAtMonotonicMs: number;
};

export const initialDriverTrackingViewState: DriverTrackingViewState = {
    status: 'inactive',
    lastAttemptAt: null,
    lastAcceptedAt: null,
    nextRetryAt: null,
    retryAttempt: 0,
    sampleQueued: false,
    reason: null,
};

function validDateMs(value: string) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function isDeliveryTrackingStatus(
    value: unknown,
): value is DeliveryTrackingStatus {
    return (
        value === 'live' ||
        value === 'delayed' ||
        value === 'offline' ||
        value === 'unavailable'
    );
}

function responseErrorCode(body: unknown) {
    return typeof body === 'object' &&
        body !== null &&
        'code' in body &&
        typeof body.code === 'string'
        ? body.code
        : null;
}

export function parseDriverLocationAcknowledgement(
    value: unknown,
): DriverLocationAcknowledgement | null {
    if (
        typeof value !== 'object' ||
        value === null ||
        !('status' in value) ||
        !isDeliveryTrackingStatus(value.status) ||
        !('acceptedAt' in value) ||
        typeof value.acceptedAt !== 'string' ||
        validDateMs(value.acceptedAt) === null ||
        !('refreshedAt' in value) ||
        typeof value.refreshedAt !== 'string' ||
        validDateMs(value.refreshedAt) === null ||
        Date.parse(value.refreshedAt) < Date.parse(value.acceptedAt) ||
        !('replayed' in value) ||
        typeof value.replayed !== 'boolean'
    ) {
        return null;
    }
    return {
        status: value.status,
        acceptedAt: value.acceptedAt,
        refreshedAt: value.refreshedAt,
        replayed: value.replayed,
    };
}

export function parseRetryAfterMs(value: string | null, nowMs = Date.now()) {
    if (!value) return null;
    const seconds = Number(value);
    const delayMs = Number.isFinite(seconds)
        ? seconds * 1_000
        : Date.parse(value) - nowMs;
    if (!Number.isFinite(delayMs) || delayMs < 0) return null;
    return Math.min(delayMs, driverTrackingMaximumRetryDelayMs);
}

export function classifyDriverLocationResponse({
    status,
    body,
    retryAfter,
    nowMs,
}: {
    status: number;
    body: unknown;
    retryAfter: string | null;
    nowMs?: number;
}): DriverLocationResponseResult {
    if (status >= 200 && status < 300) {
        const acknowledgement = parseDriverLocationAcknowledgement(body);
        return acknowledgement
            ? { kind: 'acknowledged', acknowledgement }
            : {
                  kind: 'retry',
                  retryAfterMs: parseRetryAfterMs(retryAfter, nowMs),
              };
    }

    const errorCode = responseErrorCode(body);
    if (errorCode === 'location-stale' || errorCode === 'location-conflict') {
        return { kind: 'reconcile' };
    }
    if (status === 408 || status === 425 || status === 429 || status >= 500) {
        return {
            kind: 'retry',
            retryAfterMs: parseRetryAfterMs(retryAfter, nowMs),
        };
    }
    return {
        kind: 'reject',
        acceptNewSample: status === 400 || status === 422,
        reason:
            status === 400 || status === 422
                ? 'invalid-sample'
                : 'server-rejected',
    };
}

export function selectNewestDriverLocationSample(
    current: DriverLocationSample | null,
    candidate: DriverLocationSample,
) {
    if (!current || candidate.recordedAtMs > current.recordedAtMs) {
        return candidate;
    }
    return current;
}

export function driverLocationSampleIsExpired(
    sample: DriverLocationSample,
    nowMonotonicMs: number,
    nowWallMs: number,
) {
    return (
        nowMonotonicMs > sample.expiresAtMonotonicMs ||
        nowWallMs > sample.expiresAtWallMs
    );
}

export function driverTrackingRetryDelayMs({
    retryAttempt,
    randomValue,
    retryAfterMs,
}: {
    retryAttempt: number;
    randomValue: number;
    retryAfterMs?: number | null;
}) {
    if (retryAfterMs !== null && retryAfterMs !== undefined) {
        return Math.min(
            Math.max(0, retryAfterMs),
            driverTrackingMaximumRetryDelayMs,
        );
    }
    const boundedAttempt = Math.max(1, Math.floor(retryAttempt));
    const baseDelay = Math.min(
        driverTrackingInitialRetryDelayMs * 2 ** (boundedAttempt - 1),
        driverTrackingMaximumRetryDelayMs,
    );
    const boundedRandom = Math.min(1, Math.max(0, randomValue));
    const jitter = (boundedRandom * 2 - 1) * driverTrackingRetryJitterRatio;
    return Math.min(
        Math.round(baseDelay * (1 + jitter)),
        driverTrackingMaximumRetryDelayMs,
    );
}

export function driverTrackingNextAttemptAt({
    nowMonotonicMs,
    lastAttemptAtMonotonicMs,
    requestedDelayMs,
}: {
    nowMonotonicMs: number;
    lastAttemptAtMonotonicMs: number | null;
    requestedDelayMs: number;
}) {
    return Math.max(
        nowMonotonicMs + Math.max(0, requestedDelayMs),
        lastAttemptAtMonotonicMs === null
            ? nowMonotonicMs
            : lastAttemptAtMonotonicMs + driverTrackingMinimumAttemptIntervalMs,
    );
}

export function driverTrackingStatusFromAcknowledgement(
    status: DeliveryTrackingStatus,
): 'active' | 'delayed' {
    return status === 'live' ? 'active' : 'delayed';
}

export function driverTrackingStatusAfterElapsed(
    elapsedMs: number,
): 'active' | 'delayed' {
    return elapsedMs <= driverTrackingLiveThresholdMs ? 'active' : 'delayed';
}

export function parseDriverTrackingServerSeed({
    tracking,
    refreshedAt,
}: DriverTrackingServerSeed): ParsedDriverTrackingServerSeed | null {
    const acceptedAt = tracking.lastAcceptedAt;
    const acceptedAtMs = acceptedAt ? validDateMs(acceptedAt) : null;
    const refreshedAtMs = validDateMs(refreshedAt);
    if (
        acceptedAt === null ||
        acceptedAtMs === null ||
        refreshedAtMs === null
    ) {
        return null;
    }
    const ageAtRefreshMs = Math.max(0, refreshedAtMs - acceptedAtMs);
    const status: ParsedDriverTrackingServerSeed['status'] =
        tracking.status === 'live' &&
        ageAtRefreshMs <= driverTrackingLiveThresholdMs
            ? 'active'
            : 'delayed';
    return {
        acceptedAt,
        acceptedAtMs,
        refreshedAtMs,
        ageAtRefreshMs,
        status,
    };
}

export function driverTrackingServerSeedIsNewer(
    seed: ParsedDriverTrackingServerSeed,
    latestAcceptedAtMs: number | null,
) {
    return (
        latestAcceptedAtMs === null || seed.acceptedAtMs > latestAcceptedAtMs
    );
}

/**
 * Memory-only queue and acknowledgement state for one active delivery run.
 * Exact telemetry never leaves this controller except for the single sample
 * returned to the upload boundary.
 */
export class DriverTrackingController {
    private pending: DriverLocationSample | null = null;
    private inFlight: DriverLocationSample | null = null;
    private lastAttemptAtMonotonicMs: number | null = null;
    private latestAcceptedAtMs: number | null = null;
    private acknowledgedAtMonotonicMs: number | null = null;
    private acknowledgedAtWallMs: number | null = null;
    private acceptedAt: string | null = null;
    private retryCount = 0;
    private retryNotBeforeMonotonicMs: number | null = null;
    private blockedReason: 'permission' | 'server' | null = null;
    private highestObservedRecordedAtMs: number | null = null;

    get hasPendingSample() {
        return this.pending !== null;
    }

    get hasInFlightSample() {
        return this.inFlight !== null;
    }

    get pendingExpiresAtMonotonicMs() {
        return this.pending?.expiresAtMonotonicMs ?? null;
    }

    get retryAttempt() {
        return this.retryCount;
    }

    get lastAcceptedAt() {
        return this.acceptedAt;
    }

    get acknowledgementMonotonicMs() {
        return this.acknowledgedAtMonotonicMs;
    }

    queueSample(sample: DriverLocationSample) {
        if (this.blockedReason !== null) return false;
        if (
            this.highestObservedRecordedAtMs !== null &&
            sample.recordedAtMs <= this.highestObservedRecordedAtMs
        ) {
            return false;
        }
        this.highestObservedRecordedAtMs = sample.recordedAtMs;
        if (
            this.inFlight &&
            sample.recordedAtMs <= this.inFlight.recordedAtMs
        ) {
            return false;
        }
        const previous = this.pending;
        this.pending = selectNewestDriverLocationSample(previous, sample);
        return this.pending !== previous;
    }

    beginAttempt(
        nowMonotonicMs: number,
        nowWallMs: number,
    ): DriverTrackingAttemptResult {
        if (this.blockedReason !== null) return { kind: 'blocked' };
        if (this.inFlight || !this.pending) return { kind: 'none' };
        if (
            driverLocationSampleIsExpired(
                this.pending,
                nowMonotonicMs,
                nowWallMs,
            )
        ) {
            this.pending = null;
            return { kind: 'expired' };
        }
        const eligibleAtMonotonicMs = this.nextAttemptAt(nowMonotonicMs);
        if (eligibleAtMonotonicMs === null) return { kind: 'blocked' };
        if (eligibleAtMonotonicMs > nowMonotonicMs) {
            return { kind: 'wait', eligibleAtMonotonicMs };
        }
        const sample = this.pending;
        this.pending = null;
        this.inFlight = sample;
        this.lastAttemptAtMonotonicMs = nowMonotonicMs;
        return { kind: 'send', sample };
    }

    retryInFlight({
        nowMonotonicMs,
        retryAfterMs,
        randomValue,
    }: {
        nowMonotonicMs: number;
        retryAfterMs: number | null;
        randomValue: number;
    }): DriverTrackingRetryResult | null {
        if (!this.inFlight) return null;
        this.pending = selectNewestDriverLocationSample(
            this.inFlight,
            this.pending ?? this.inFlight,
        );
        this.inFlight = null;
        this.retryCount += 1;
        const requestedDelayMs = driverTrackingRetryDelayMs({
            retryAttempt: this.retryCount,
            randomValue,
            retryAfterMs,
        });
        this.retryNotBeforeMonotonicMs = nowMonotonicMs + requestedDelayMs;
        return {
            retryAttempt: this.retryCount,
            requestedDelayMs,
            eligibleAtMonotonicMs:
                this.nextAttemptAt(nowMonotonicMs) ??
                nowMonotonicMs + requestedDelayMs,
        };
    }

    acknowledge(
        acknowledgement: DriverLocationAcknowledgement,
        nowMonotonicMs: number,
        nowWallMs: number,
        minimumInitialAgeMs = 0,
    ) {
        this.inFlight = null;
        this.retryCount = 0;
        this.retryNotBeforeMonotonicMs = null;
        this.blockedReason = null;
        const acceptedAtMs = Date.parse(acknowledgement.acceptedAt);
        if (
            this.latestAcceptedAtMs !== null &&
            acceptedAtMs <= this.latestAcceptedAtMs
        ) {
            return false;
        }
        this.acceptedAt = acknowledgement.acceptedAt;
        this.latestAcceptedAtMs = acceptedAtMs;
        const serverAgeMs = Math.max(
            0,
            Date.parse(acknowledgement.refreshedAt) - acceptedAtMs,
        );
        const initialAgeMs = Math.max(
            serverAgeMs,
            Number.isFinite(minimumInitialAgeMs)
                ? Math.max(0, minimumInitialAgeMs)
                : 0,
            acknowledgement.status === 'live'
                ? 0
                : driverTrackingLiveThresholdMs + 1,
        );
        this.acknowledgedAtMonotonicMs = nowMonotonicMs - initialAgeMs;
        this.acknowledgedAtWallMs = nowWallMs - initialAgeMs;
        return true;
    }

    rejectInFlight({ acceptNewSample }: { acceptNewSample: boolean }) {
        this.inFlight = null;
        this.retryCount = 0;
        this.retryNotBeforeMonotonicMs = null;
        this.blockedReason = acceptNewSample ? null : 'server';
        if (this.blockedReason) this.pending = null;
    }

    reconcileInFlight() {
        this.inFlight = null;
        this.retryCount = 0;
        this.retryNotBeforeMonotonicMs = null;
    }

    blockAndDiscardExactSamples() {
        this.pending = null;
        this.inFlight = null;
        this.retryCount = 0;
        this.retryNotBeforeMonotonicMs = null;
        this.blockedReason = 'permission';
    }

    allowPermissionUploads() {
        if (this.blockedReason === 'permission') this.blockedReason = null;
    }

    discard() {
        this.pending = null;
        this.inFlight = null;
        this.retryCount = 0;
        this.retryNotBeforeMonotonicMs = null;
        this.blockedReason = 'server';
    }

    nextAttemptAt(nowMonotonicMs: number) {
        if (!this.pending || this.blockedReason !== null) return null;
        return Math.max(
            driverTrackingNextAttemptAt({
                nowMonotonicMs,
                lastAttemptAtMonotonicMs: this.lastAttemptAtMonotonicMs,
                requestedDelayMs: 0,
            }),
            this.retryNotBeforeMonotonicMs ?? nowMonotonicMs,
        );
    }

    advanceRetry(nowMonotonicMs: number) {
        if (this.retryCount > 0) {
            this.retryNotBeforeMonotonicMs = nowMonotonicMs;
        }
        return this.nextAttemptAt(nowMonotonicMs);
    }

    dropExpiredPending(nowMonotonicMs: number, nowWallMs: number) {
        if (
            !this.pending ||
            !driverLocationSampleIsExpired(
                this.pending,
                nowMonotonicMs,
                nowWallMs,
            )
        ) {
            return false;
        }
        this.pending = null;
        return true;
    }

    acknowledgementStatus(nowMonotonicMs: number, nowWallMs: number) {
        if (
            this.acknowledgedAtMonotonicMs === null ||
            this.acknowledgedAtWallMs === null
        ) {
            return null;
        }
        return driverTrackingStatusAfterElapsed(
            Math.max(
                nowMonotonicMs - this.acknowledgedAtMonotonicMs,
                nowWallMs - this.acknowledgedAtWallMs,
            ),
        );
    }

    reconcileServerSeed(
        seed: DriverTrackingServerSeed,
        nowMonotonicMs: number,
        nowWallMs: number,
    ) {
        const parsed = parseDriverTrackingServerSeed(seed);
        if (!parsed) return null;
        const strictlyNewer =
            this.latestAcceptedAtMs === null ||
            parsed.acceptedAtMs > this.latestAcceptedAtMs;
        if (
            this.latestAcceptedAtMs !== null &&
            parsed.acceptedAtMs < this.latestAcceptedAtMs
        ) {
            return null;
        }
        if (
            parsed.acceptedAtMs === this.latestAcceptedAtMs &&
            this.acknowledgedAtMonotonicMs !== null &&
            this.acknowledgedAtWallMs !== null
        ) {
            const currentAgeMs = Math.max(
                nowMonotonicMs - this.acknowledgedAtMonotonicMs,
                nowWallMs - this.acknowledgedAtWallMs,
            );
            if (parsed.ageAtRefreshMs <= currentAgeMs) return null;
        }
        this.latestAcceptedAtMs = parsed.acceptedAtMs;
        this.acceptedAt = parsed.acceptedAt;
        this.acknowledgedAtMonotonicMs = nowMonotonicMs - parsed.ageAtRefreshMs;
        this.acknowledgedAtWallMs = nowWallMs - parsed.ageAtRefreshMs;
        if (strictlyNewer) {
            this.retryCount = 0;
            this.retryNotBeforeMonotonicMs = null;
            if (this.blockedReason === 'server') this.blockedReason = null;
        }
        return parsed;
    }
}
