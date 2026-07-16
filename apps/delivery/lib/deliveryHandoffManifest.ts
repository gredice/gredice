import type {
    DeliveryRunHandoffItemSnapshot,
    DeliveryRunHandoffItemState,
    DeliveryRunHandoffManifest,
    DeliveryRunHandoffSkipReason,
} from '@gredice/storage';
import {
    type DeliveryActionQueueEntry,
    type DeliveryActionQueueSnapshot,
    type DeliveryHandoffOperationOutcome,
    isDeliveryHandoffCommand,
} from './deliveryActionQueue';
import { normalizeHarvestTraceScanValue } from './harvestTraceScan';

export type DeliveryHandoffManifest = DeliveryRunHandoffManifest;

export type DeliveryHandoffManifestScope = {
    userId: string;
    runId: string;
    targetStopId: number;
    expectedRetryAttempt: number;
};

export type DeliveryHandoffTraceItem = {
    stopId: number;
    tracePath: string | null;
};

export type DeliveryHandoffManifestProjection = {
    manifest: DeliveryHandoffManifest;
    pendingOperationIds: string[];
    failedOperationIds: string[];
    conflictedOperationIds: string[];
    acknowledgedOutcomes: Array<{
        operationId: string;
        outcome: DeliveryHandoffOperationOutcome;
    }>;
};

export type DeliveryHandoffManifestFetchResult =
    | { status: 'loaded'; manifest: DeliveryHandoffManifest }
    | { status: 'retryable-failure'; code?: string }
    | { status: 'permanent-failure'; code?: string };

const manifestKeys = [
    'runId',
    'targetStopId',
    'version',
    'retryAttempt',
    'items',
    'expectedCount',
    'scannedCount',
    'unverifiedCount',
    'noLabelCount',
    'missingCount',
    'skippedCount',
];
const itemKeys = [
    'stopId',
    'deliveryRequestId',
    'retryAttempt',
    'traceLinkId',
    'qrAvailable',
    'state',
    'reason',
    'verifiedAt',
];

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: string[]) {
    const allowedKeys = new Set(allowed);
    return Object.keys(value).every((key) => allowedKeys.has(key));
}

function validIdentifier(value: unknown): value is string {
    return (
        typeof value === 'string' &&
        value.trim() === value &&
        value.length > 0 &&
        value.length <= 256
    );
}

function validStopId(value: unknown): value is number {
    return (
        typeof value === 'number' &&
        Number.isSafeInteger(value) &&
        value > 0 &&
        value <= 2_147_483_647
    );
}

function validCount(value: unknown): value is number {
    return (
        typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    );
}

function validItemState(value: unknown): value is DeliveryRunHandoffItemState {
    return (
        value === 'unverified' ||
        value === 'scanned' ||
        value === 'no-label' ||
        value === 'missing' ||
        value === 'skipped'
    );
}

function validSkipReason(
    value: unknown,
): value is DeliveryRunHandoffSkipReason {
    return (
        value === 'scanner-unavailable' ||
        value === 'label-unreadable' ||
        value === 'manual-verification' ||
        value === 'other-operational'
    );
}

function validVerifiedAt(value: unknown): value is string | null {
    return (
        value === null ||
        (typeof value === 'string' &&
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
            Number.isFinite(Date.parse(value)))
    );
}

function parseManifestItem(
    value: unknown,
): DeliveryRunHandoffItemSnapshot | null {
    if (
        !isRecord(value) ||
        !hasOnlyKeys(value, itemKeys) ||
        !validStopId(value.stopId) ||
        !validIdentifier(value.deliveryRequestId) ||
        !validCount(value.retryAttempt) ||
        !(
            value.traceLinkId === null ||
            (typeof value.traceLinkId === 'number' &&
                Number.isSafeInteger(value.traceLinkId) &&
                value.traceLinkId > 0)
        ) ||
        typeof value.qrAvailable !== 'boolean' ||
        (value.qrAvailable && value.traceLinkId === null) ||
        !validItemState(value.state) ||
        !validVerifiedAt(value.verifiedAt)
    ) {
        return null;
    }
    let reason: DeliveryRunHandoffSkipReason | null = null;
    if (value.state === 'skipped') {
        if (!validSkipReason(value.reason)) return null;
        reason = value.reason;
    } else if (value.reason !== null) {
        return null;
    }
    return {
        stopId: value.stopId,
        deliveryRequestId: value.deliveryRequestId,
        retryAttempt: value.retryAttempt,
        traceLinkId: value.traceLinkId,
        qrAvailable: value.qrAvailable,
        state: value.state,
        reason,
        verifiedAt: value.verifiedAt,
    };
}

export function parseDeliveryHandoffManifest(
    value: unknown,
): DeliveryHandoffManifest | null {
    if (
        !isRecord(value) ||
        !hasOnlyKeys(value, manifestKeys) ||
        !validIdentifier(value.runId) ||
        !validStopId(value.targetStopId) ||
        value.version !== 1 ||
        !validCount(value.retryAttempt) ||
        !Array.isArray(value.items) ||
        !validCount(value.expectedCount) ||
        !validCount(value.scannedCount) ||
        !validCount(value.unverifiedCount) ||
        !validCount(value.noLabelCount) ||
        !validCount(value.missingCount) ||
        !validCount(value.skippedCount)
    ) {
        return null;
    }
    const items: DeliveryRunHandoffItemSnapshot[] = [];
    const stopIds = new Set<number>();
    for (const candidate of value.items) {
        const item = parseManifestItem(candidate);
        if (
            !item ||
            item.retryAttempt !== value.retryAttempt ||
            stopIds.has(item.stopId)
        ) {
            return null;
        }
        stopIds.add(item.stopId);
        items.push(item);
    }
    const count = (state: DeliveryRunHandoffItemState) =>
        items.filter((item) => item.state === state).length;
    if (
        value.expectedCount !== items.length ||
        (items.length > 0 && !stopIds.has(value.targetStopId)) ||
        value.scannedCount !== count('scanned') ||
        value.unverifiedCount !== count('unverified') ||
        value.noLabelCount !== count('no-label') ||
        value.missingCount !== count('missing') ||
        value.skippedCount !== count('skipped')
    ) {
        return null;
    }
    return {
        runId: value.runId,
        targetStopId: value.targetStopId,
        version: 1,
        retryAttempt: value.retryAttempt,
        items,
        expectedCount: value.expectedCount,
        scannedCount: value.scannedCount,
        unverifiedCount: value.unverifiedCount,
        noLabelCount: value.noLabelCount,
        missingCount: value.missingCount,
        skippedCount: value.skippedCount,
    };
}

function responseCode(value: unknown) {
    if (
        isRecord(value) &&
        typeof value.code === 'string' &&
        /^[a-z0-9-]{1,128}$/.test(value.code)
    ) {
        return value.code;
    }
    return undefined;
}

export async function fetchDeliveryHandoffManifest({
    runId,
    targetStopId,
    signal,
    fetcher = fetch,
}: {
    runId: string;
    targetStopId: number;
    signal?: AbortSignal;
    fetcher?: typeof fetch;
}): Promise<DeliveryHandoffManifestFetchResult> {
    let response: Response;
    try {
        response = await fetcher(
            `/api/driver/runs/${encodeURIComponent(runId)}/stops/${targetStopId}/handoff/mutations`,
            { method: 'GET', signal },
        );
    } catch {
        return { status: 'retryable-failure', code: 'offline' };
    }
    const value: unknown = await response.json().catch(() => null);
    if (!response.ok) {
        const code = responseCode(value);
        return response.status === 408 ||
            response.status === 425 ||
            response.status === 429 ||
            response.status >= 500
            ? { status: 'retryable-failure', code }
            : { status: 'permanent-failure', code };
    }
    const manifest = parseDeliveryHandoffManifest(value);
    if (
        manifest &&
        (manifest.runId !== runId || manifest.targetStopId !== targetStopId)
    ) {
        return {
            status: 'retryable-failure',
            code: 'manifest-identity-mismatch',
        };
    }
    return manifest
        ? { status: 'loaded', manifest }
        : { status: 'retryable-failure', code: 'invalid-manifest' };
}

export function deliveryHandoffQueueEntries(
    snapshot: DeliveryActionQueueSnapshot | null,
    manifest: DeliveryHandoffManifest,
) {
    return (
        snapshot?.entries.filter(
            (entry) =>
                isDeliveryHandoffCommand(entry.command) &&
                entry.command.runId === manifest.runId &&
                entry.command.stopId === manifest.targetStopId &&
                entry.command.expectedRetryAttempt === manifest.retryAttempt,
        ) ?? []
    );
}

function resolvedScanStopIds(
    entry: DeliveryActionQueueEntry,
    traceItems: readonly DeliveryHandoffTraceItem[],
) {
    if (entry.command.kind !== 'verification-scan') return [];
    const normalized = normalizeHarvestTraceScanValue(entry.command.tracePath);
    if (!normalized) return [];
    return traceItems.flatMap((item) =>
        item.tracePath &&
        normalizeHarvestTraceScanValue(item.tracePath) === normalized
            ? [item.stopId]
            : [],
    );
}

function projectedItemState(
    entry: DeliveryActionQueueEntry,
    traceItems: readonly DeliveryHandoffTraceItem[],
): {
    stopIds: number[];
    state: DeliveryRunHandoffItemState;
    reason: DeliveryRunHandoffSkipReason | null;
} | null {
    if (!isDeliveryHandoffCommand(entry.command)) return null;
    if (entry.state === 'conflicted') return null;
    if (entry.acknowledgement?.kind === 'handoff') {
        if (
            entry.acknowledgement.result.outcome !== 'applied' &&
            entry.acknowledgement.result.outcome !== 'already-applied'
        ) {
            return null;
        }
        const itemState = entry.acknowledgement.result.itemState;
        if (!itemState) return null;
        return {
            stopIds: entry.acknowledgement.result.affectedStopIds,
            state: itemState,
            reason: entry.acknowledgement.result.reason ?? null,
        };
    }
    if (entry.command.kind === 'verification-mark') {
        return {
            stopIds: [entry.command.itemStopId],
            state: entry.command.outcome,
            reason: entry.command.reason ?? null,
        };
    }
    return {
        stopIds: resolvedScanStopIds(entry, traceItems),
        state: 'scanned',
        reason: null,
    };
}

function withRecomputedCounts(
    manifest: DeliveryHandoffManifest,
    items: DeliveryRunHandoffItemSnapshot[],
): DeliveryHandoffManifest {
    const count = (state: DeliveryRunHandoffItemState) =>
        items.filter((item) => item.state === state).length;
    return {
        ...manifest,
        items,
        expectedCount: items.length,
        scannedCount: count('scanned'),
        unverifiedCount: count('unverified'),
        noLabelCount: count('no-label'),
        missingCount: count('missing'),
        skippedCount: count('skipped'),
    };
}

export function projectDeliveryHandoffManifest({
    manifest,
    snapshot,
    traceItems = [],
}: {
    manifest: DeliveryHandoffManifest;
    snapshot: DeliveryActionQueueSnapshot | null;
    traceItems?: readonly DeliveryHandoffTraceItem[];
}): DeliveryHandoffManifestProjection {
    const entries = deliveryHandoffQueueEntries(snapshot, manifest).sort(
        (first, second) => first.sequence - second.sequence,
    );
    let items = manifest.items.map((item) => ({ ...item }));
    for (const entry of entries) {
        const projected = projectedItemState(entry, traceItems);
        if (!projected || projected.stopIds.length === 0) continue;
        const affectedIds = new Set(projected.stopIds);
        items = items.map((item) => {
            if (!affectedIds.has(item.stopId)) return item;
            if (
                item.verifiedAt &&
                Date.parse(item.verifiedAt) >=
                    Date.parse(entry.command.occurredAt)
            ) {
                return item;
            }
            return {
                ...item,
                state: projected.state,
                reason: projected.reason,
                verifiedAt: entry.command.occurredAt,
            };
        });
    }
    return {
        manifest: withRecomputedCounts(manifest, items),
        pendingOperationIds: entries.flatMap((entry) =>
            entry.state === 'queued' || entry.state === 'sending'
                ? [entry.command.operationId]
                : [],
        ),
        failedOperationIds: entries.flatMap((entry) =>
            entry.state === 'failed' ? [entry.command.operationId] : [],
        ),
        conflictedOperationIds: entries.flatMap((entry) =>
            entry.state === 'conflicted' ? [entry.command.operationId] : [],
        ),
        acknowledgedOutcomes: entries.flatMap((entry) =>
            entry.acknowledgement?.kind === 'handoff'
                ? [
                      {
                          operationId: entry.command.operationId,
                          outcome: entry.acknowledgement.result.outcome,
                      },
                  ]
                : [],
        ),
    };
}
