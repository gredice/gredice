import { and, eq, gte, inArray, lte, or, sql } from 'drizzle-orm';
import 'server-only';
import {
    deliveryRunExactLocationTtlMs,
    deliveryRunTrackingLiveThresholdMs,
} from '../deliveryTrackingPolicy';
import {
    type DeliveryRunEstimateSource,
    type DeliveryRunExceptionReason,
    DeliveryRunExceptionReasons,
    type DeliveryRunState,
    DeliveryRunStates,
    type DeliveryRunStopState,
    deliveryRunExceptionOperations,
    deliveryRunHandoffOperations,
    deliveryRunPickupOperations,
    deliveryRunStopOperations,
    deliveryRuns,
} from '../schema';
import { storage } from '../storage';

const defaultWindowMs = 24 * 60 * 60 * 1000;
const maximumWindowMs = 30 * 24 * 60 * 60 * 1000;
const defaultDiagnosticLimit = 100;
const maximumDiagnosticLimit = 200;
const maximumExceptionOutcomesPerReceipt = 200;

export const deliveryOperationalStaleRerouteMs = 10 * 60 * 1000;
export const deliveryOperationalStalledRunMs = 60 * 60 * 1000;
export const deliveryOperationalDelayedReplayMs = 5 * 60 * 1000;
export const deliveryOperationalFallbackWarningRate = 0.25;
export const deliveryOperationalFallbackMinimumSample = 4;

export type DeliveryOperationalSeverity = 'healthy' | 'warning' | 'critical';

export type DeliveryOperationalDiagnosticKind =
    | 'abandoned-run'
    | 'delayed-offline-replay'
    | 'exception-outcome'
    | 'local-route-fallback'
    | 'reroute-stale'
    | 'run-stalled'
    | 'tracking-delayed'
    | 'tracking-unavailable';

export type DeliveryOperationalReplayKind =
    | 'pickup'
    | 'handoff'
    | 'exception'
    | 'stop';

export type DeliveryOperationalDiagnostic = {
    ageMs?: number;
    count: number;
    kind: DeliveryOperationalDiagnosticKind;
    occurredAt: Date;
    reasonCode: string;
    runId: string;
    severity: 'info' | 'warning' | 'critical';
};

export type DeliveryOperationalExceptionMetric = {
    count: number;
    outcome: Extract<DeliveryRunStopState, 'deferred' | 'failed' | 'cancelled'>;
    reason: DeliveryRunExceptionReason;
};

export type DeliveryOperationalHealth = {
    actions: {
        delayedReplayCount: number;
        maximumReplayDelayMs: number;
    };
    alerts: {
        delayedOfflineReplay: boolean;
        elevatedLocalFallback: boolean;
        staleReroute: boolean;
        stalledRun: boolean;
        trackingUnavailable: boolean;
    };
    diagnostics: {
        items: DeliveryOperationalDiagnostic[];
        truncated: boolean;
    };
    exceptions: DeliveryOperationalExceptionMetric[];
    from: Date;
    reroutes: {
        pendingCount: number;
        staleCount: number;
    };
    runs: {
        abandonedCount: number;
        activeCount: number;
        completedCount: number;
        localFallbackCount: number;
        localFallbackRate: number;
        modernPlanCount: number;
        stalledCount: number;
    };
    severity: DeliveryOperationalSeverity;
    to: Date;
    tracking: {
        delayedCount: number;
        liveCount: number;
        notReceivedCount: number;
        unavailableCount: number;
    };
};

export type DeliveryOperationalRunSample = {
    completedAt: Date | null;
    currentLocationReceivedAt: Date | null;
    estimateSource: DeliveryRunEstimateSource;
    estimatesUpdatedAt: Date | null;
    id: string;
    rerouteAttemptedAt: Date | null;
    rerouteRequiredAt: Date | null;
    routePlanVersion: number;
    startedAt: Date;
    state: DeliveryRunState;
    updatedAt: Date;
};

export type DeliveryOperationalExceptionSample = {
    occurredAt: Date;
    outcome: Extract<DeliveryRunStopState, 'deferred' | 'failed' | 'cancelled'>;
    reason: DeliveryRunExceptionReason;
    runId: string;
};

export type DeliveryOperationalReplaySample = {
    appliedAt: Date;
    kind: DeliveryOperationalReplayKind;
    occurredAt: Date;
    runId: string;
};

export type DeliveryOperationalHealthProjectionInput = {
    diagnosticLimit?: number;
    exceptionSamples: DeliveryOperationalExceptionSample[];
    from: Date;
    now: Date;
    replaySamples: DeliveryOperationalReplaySample[];
    runSamples: DeliveryOperationalRunSample[];
    to: Date;
};

function maximumDate(values: Array<Date | null>) {
    return values.reduce<Date | null>((latest, value) => {
        if (!value) return latest;
        return !latest || value > latest ? value : latest;
    }, null);
}

function nonnegativeAgeMs(now: Date, occurredAt: Date) {
    return Math.max(0, now.getTime() - occurredAt.getTime());
}

function boundedOpaqueRunId(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(
        value,
    )
        ? value
        : 'run-id-unavailable';
}

function diagnosticLimit(value: number | undefined) {
    if (value === undefined) return defaultDiagnosticLimit;
    if (!Number.isInteger(value) || value < 1) {
        throw new Error('diagnosticLimit must be a positive integer.');
    }
    return Math.min(value, maximumDiagnosticLimit);
}

function diagnosticKey(runId: string, outcome: string, reason: string) {
    return `${runId}\u0000${outcome}\u0000${reason}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isDeliveryOperationalExceptionReason(
    value: unknown,
): value is DeliveryRunExceptionReason {
    return Object.values(DeliveryRunExceptionReasons).some(
        (reason) => reason === value,
    );
}

export function deliveryOperationalExceptionSamplesFromProjection({
    occurredAt,
    outcomes,
    runId,
}: {
    occurredAt: Date;
    outcomes: unknown;
    runId: string;
}): DeliveryOperationalExceptionSample[] {
    if (!Array.isArray(outcomes)) return [];
    if (outcomes.length > maximumExceptionOutcomesPerReceipt) return [];

    return outcomes.flatMap((outcome) =>
        isRecord(outcome) &&
        isDeliveryOperationalExceptionOutcome(outcome.outcome) &&
        isDeliveryOperationalExceptionReason(outcome.reason)
            ? [
                  {
                      occurredAt,
                      outcome: outcome.outcome,
                      reason: outcome.reason,
                      runId,
                  },
              ]
            : [],
    );
}

export function projectDeliveryOperationalHealth({
    diagnosticLimit: requestedDiagnosticLimit,
    exceptionSamples,
    from,
    now,
    replaySamples,
    runSamples,
    to,
}: DeliveryOperationalHealthProjectionInput): DeliveryOperationalHealth {
    const limit = diagnosticLimit(requestedDiagnosticLimit);
    const diagnostics: DeliveryOperationalDiagnostic[] = [];
    const activeRuns = runSamples.filter(
        (run) => run.state === DeliveryRunStates.ACTIVE,
    );
    const modernRuns = runSamples.filter((run) => run.routePlanVersion >= 2);
    const localFallbackRuns = modernRuns.filter(
        (run) => run.estimateSource === 'local',
    );
    const latestAppliedReceiptByRunId = new Map<string, Date>();
    for (const sample of replaySamples) {
        const latest = latestAppliedReceiptByRunId.get(sample.runId);
        if (!latest || sample.appliedAt > latest) {
            latestAppliedReceiptByRunId.set(sample.runId, sample.appliedAt);
        }
    }
    const elevatedLocalFallback =
        modernRuns.length >= deliveryOperationalFallbackMinimumSample &&
        localFallbackRuns.length / modernRuns.length >=
            deliveryOperationalFallbackWarningRate;

    let trackingLiveCount = 0;
    let trackingDelayedCount = 0;
    let trackingUnavailableCount = 0;
    let trackingNotReceivedCount = 0;
    let trackingNotReceivedWarning = false;
    let staleRerouteCount = 0;
    let stalledRunCount = 0;
    let trackingUnavailableAlert = false;

    for (const run of activeRuns) {
        const runId = boundedOpaqueRunId(run.id);
        const runAgeMs = nonnegativeAgeMs(now, run.startedAt);
        const locationAgeMs = run.currentLocationReceivedAt
            ? nonnegativeAgeMs(now, run.currentLocationReceivedAt)
            : null;

        if (locationAgeMs === null) {
            trackingNotReceivedCount += 1;
            if (runAgeMs > deliveryRunTrackingLiveThresholdMs) {
                trackingNotReceivedWarning = true;
                const unavailable = runAgeMs > deliveryRunExactLocationTtlMs;
                trackingUnavailableAlert ||= unavailable;
                diagnostics.push({
                    ageMs: runAgeMs,
                    count: 1,
                    kind: 'tracking-unavailable',
                    occurredAt: run.startedAt,
                    reasonCode: 'tracking-not-received',
                    runId,
                    severity: unavailable ? 'critical' : 'warning',
                });
            }
        } else if (locationAgeMs <= deliveryRunTrackingLiveThresholdMs) {
            trackingLiveCount += 1;
        } else if (locationAgeMs <= deliveryRunExactLocationTtlMs) {
            trackingDelayedCount += 1;
            diagnostics.push({
                ageMs: locationAgeMs,
                count: 1,
                kind: 'tracking-delayed',
                occurredAt: run.currentLocationReceivedAt ?? run.startedAt,
                reasonCode: 'tracking-delayed',
                runId,
                severity: 'warning',
            });
        } else {
            trackingUnavailableCount += 1;
            trackingUnavailableAlert = true;
            diagnostics.push({
                ageMs: locationAgeMs,
                count: 1,
                kind: 'tracking-unavailable',
                occurredAt: run.currentLocationReceivedAt ?? run.startedAt,
                reasonCode: 'tracking-offline',
                runId,
                severity: 'critical',
            });
        }

        if (run.rerouteRequiredAt) {
            const rerouteAgeMs = nonnegativeAgeMs(now, run.rerouteRequiredAt);
            if (rerouteAgeMs >= deliveryOperationalStaleRerouteMs) {
                staleRerouteCount += 1;
                diagnostics.push({
                    ageMs: rerouteAgeMs,
                    count: 1,
                    kind: 'reroute-stale',
                    occurredAt: run.rerouteRequiredAt,
                    reasonCode: run.rerouteAttemptedAt
                        ? 'reroute-attempt-stale'
                        : 'reroute-not-attempted',
                    runId,
                    severity: 'critical',
                });
            }
        }

        const lastActivityAt = maximumDate([
            run.startedAt,
            run.updatedAt,
            run.currentLocationReceivedAt,
            run.estimatesUpdatedAt,
            latestAppliedReceiptByRunId.get(run.id) ?? null,
        ]);
        if (
            lastActivityAt &&
            nonnegativeAgeMs(now, lastActivityAt) >=
                deliveryOperationalStalledRunMs
        ) {
            const ageMs = nonnegativeAgeMs(now, lastActivityAt);
            stalledRunCount += 1;
            diagnostics.push({
                ageMs,
                count: 1,
                kind: 'run-stalled',
                occurredAt: lastActivityAt,
                reasonCode: 'no-recent-run-activity',
                runId,
                severity: 'critical',
            });
        }
    }

    for (const run of localFallbackRuns) {
        diagnostics.push({
            count: 1,
            kind: 'local-route-fallback',
            occurredAt:
                run.estimatesUpdatedAt ?? run.completedAt ?? run.startedAt,
            reasonCode: 'estimate-source-local',
            runId: boundedOpaqueRunId(run.id),
            severity: elevatedLocalFallback ? 'warning' : 'info',
        });
    }

    for (const run of runSamples) {
        if (run.state !== DeliveryRunStates.CANCELLED || !run.completedAt) {
            continue;
        }
        diagnostics.push({
            count: 1,
            kind: 'abandoned-run',
            occurredAt: run.completedAt,
            reasonCode: 'route-abandoned',
            runId: boundedOpaqueRunId(run.id),
            severity: 'info',
        });
    }

    const delayedReplays = replaySamples.filter(
        (sample) =>
            sample.appliedAt.getTime() - sample.occurredAt.getTime() >=
            deliveryOperationalDelayedReplayMs,
    );
    const replayGroups = new Map<
        string,
        {
            count: number;
            kind: DeliveryOperationalReplayKind;
            latestAppliedAt: Date;
            maximumDelayMs: number;
            runId: string;
        }
    >();
    for (const sample of delayedReplays) {
        const runId = boundedOpaqueRunId(sample.runId);
        const key = `${runId}\u0000${sample.kind}`;
        const delayMs =
            sample.appliedAt.getTime() - sample.occurredAt.getTime();
        const existing = replayGroups.get(key);
        replayGroups.set(key, {
            count: (existing?.count ?? 0) + 1,
            kind: sample.kind,
            latestAppliedAt:
                existing && existing.latestAppliedAt > sample.appliedAt
                    ? existing.latestAppliedAt
                    : sample.appliedAt,
            maximumDelayMs: Math.max(existing?.maximumDelayMs ?? 0, delayMs),
            runId,
        });
    }
    for (const group of replayGroups.values()) {
        diagnostics.push({
            ageMs: group.maximumDelayMs,
            count: group.count,
            kind: 'delayed-offline-replay',
            occurredAt: group.latestAppliedAt,
            reasonCode: `delayed-${group.kind}-replay`,
            runId: group.runId,
            severity: 'warning',
        });
    }

    const exceptionGroups = new Map<
        string,
        DeliveryOperationalExceptionMetric & {
            latestOccurredAt: Date;
            runId: string;
        }
    >();
    for (const sample of exceptionSamples) {
        const runId = boundedOpaqueRunId(sample.runId);
        const key = diagnosticKey(runId, sample.outcome, sample.reason);
        const existing = exceptionGroups.get(key);
        exceptionGroups.set(key, {
            count: (existing?.count ?? 0) + 1,
            latestOccurredAt:
                existing && existing.latestOccurredAt > sample.occurredAt
                    ? existing.latestOccurredAt
                    : sample.occurredAt,
            outcome: sample.outcome,
            reason: sample.reason,
            runId,
        });
    }
    for (const group of exceptionGroups.values()) {
        diagnostics.push({
            count: group.count,
            kind: 'exception-outcome',
            occurredAt: group.latestOccurredAt,
            reasonCode: `${group.outcome}:${group.reason}`,
            runId: group.runId,
            severity: 'info',
        });
    }

    const exceptionsByOutcome = new Map<
        string,
        DeliveryOperationalExceptionMetric
    >();
    for (const sample of exceptionSamples) {
        const key = `${sample.outcome}\u0000${sample.reason}`;
        const existing = exceptionsByOutcome.get(key);
        exceptionsByOutcome.set(key, {
            count: (existing?.count ?? 0) + 1,
            outcome: sample.outcome,
            reason: sample.reason,
        });
    }

    const delayedOfflineReplay = delayedReplays.length > 0;
    const staleReroute = staleRerouteCount > 0;
    const stalledRun = stalledRunCount > 0;
    const hasCritical = staleReroute || stalledRun || trackingUnavailableAlert;
    const hasWarning =
        elevatedLocalFallback ||
        delayedOfflineReplay ||
        trackingDelayedCount > 0 ||
        trackingNotReceivedWarning;
    const severityRank = { critical: 0, warning: 1, info: 2 } as const;
    const sortedDiagnostics = diagnostics.sort(
        (first, second) =>
            severityRank[first.severity] - severityRank[second.severity] ||
            second.occurredAt.getTime() - first.occurredAt.getTime() ||
            first.runId.localeCompare(second.runId) ||
            first.kind.localeCompare(second.kind),
    );

    return {
        actions: {
            delayedReplayCount: delayedReplays.length,
            maximumReplayDelayMs: delayedReplays.reduce(
                (maximum, sample) =>
                    Math.max(
                        maximum,
                        sample.appliedAt.getTime() -
                            sample.occurredAt.getTime(),
                    ),
                0,
            ),
        },
        alerts: {
            delayedOfflineReplay,
            elevatedLocalFallback,
            staleReroute,
            stalledRun,
            trackingUnavailable: trackingUnavailableAlert,
        },
        diagnostics: {
            items: sortedDiagnostics.slice(0, limit),
            truncated: sortedDiagnostics.length > limit,
        },
        exceptions: [...exceptionsByOutcome.values()].sort(
            (first, second) =>
                first.outcome.localeCompare(second.outcome) ||
                first.reason.localeCompare(second.reason),
        ),
        from,
        reroutes: {
            pendingCount: activeRuns.filter(
                (run) => run.rerouteRequiredAt !== null,
            ).length,
            staleCount: staleRerouteCount,
        },
        runs: {
            abandonedCount: runSamples.filter(
                (run) => run.state === DeliveryRunStates.CANCELLED,
            ).length,
            activeCount: activeRuns.length,
            completedCount: runSamples.filter(
                (run) => run.state === DeliveryRunStates.COMPLETED,
            ).length,
            localFallbackCount: localFallbackRuns.length,
            localFallbackRate:
                modernRuns.length === 0
                    ? 0
                    : localFallbackRuns.length / modernRuns.length,
            modernPlanCount: modernRuns.length,
            stalledCount: stalledRunCount,
        },
        severity: hasCritical ? 'critical' : hasWarning ? 'warning' : 'healthy',
        to,
        tracking: {
            delayedCount: trackingDelayedCount,
            liveCount: trackingLiveCount,
            notReceivedCount: trackingNotReceivedCount,
            unavailableCount: trackingUnavailableCount,
        },
    };
}

function validDate(value: Date, field: string) {
    if (Number.isNaN(value.getTime())) {
        throw new Error(`${field} must be a valid date.`);
    }
    return value;
}

function normalizedWindow({
    from,
    now = new Date(),
    to,
}: {
    from?: Date;
    now?: Date;
    to?: Date;
}) {
    const normalizedNow = validDate(now, 'now');
    const normalizedTo = validDate(to ?? normalizedNow, 'to');
    const normalizedFrom = validDate(
        from ?? new Date(normalizedTo.getTime() - defaultWindowMs),
        'from',
    );
    if (normalizedFrom > normalizedTo) {
        throw new Error('from must be before or equal to to.');
    }
    if (normalizedTo.getTime() - normalizedFrom.getTime() > maximumWindowMs) {
        throw new Error('Delivery operational window cannot exceed 30 days.');
    }
    return { from: normalizedFrom, now: normalizedNow, to: normalizedTo };
}

function isDeliveryRunState(value: string): value is DeliveryRunState {
    return Object.values(DeliveryRunStates).some((state) => state === value);
}

function isDeliveryOperationalExceptionOutcome(
    value: unknown,
): value is DeliveryOperationalExceptionSample['outcome'] {
    return value === 'deferred' || value === 'failed' || value === 'cancelled';
}

function relevantDeliveryRunCondition(from: Date, to: Date) {
    return or(
        and(
            eq(deliveryRuns.state, DeliveryRunStates.ACTIVE),
            lte(deliveryRuns.startedAt, to),
        ),
        and(
            inArray(deliveryRuns.state, [
                DeliveryRunStates.COMPLETED,
                DeliveryRunStates.CANCELLED,
            ]),
            gte(deliveryRuns.completedAt, from),
            lte(deliveryRuns.completedAt, to),
        ),
    );
}

// Reduce durable exception receipts inside PostgreSQL. The application never
// receives stop IDs, delivery request IDs, payload hashes, or any other receipt
// fields. Oversized and malformed receipts fail closed to an empty projection.
const deliveryOperationalExceptionOutcomesProjection = sql<unknown>`
    case
        when jsonb_typeof(${deliveryRunExceptionOperations.result}->'outcomes') = 'array'
        then case
            when jsonb_array_length(${deliveryRunExceptionOperations.result}->'outcomes') <= ${maximumExceptionOutcomesPerReceipt}
            then coalesce(
                (
                    select jsonb_agg(
                        jsonb_build_object(
                            'outcome', exception_outcome.value->>'outcome',
                            'reason', exception_outcome.value->>'reason'
                        )
                        order by exception_outcome.ordinality
                    )
                    from jsonb_array_elements(
                        ${deliveryRunExceptionOperations.result}->'outcomes'
                    ) with ordinality as exception_outcome(value, ordinality)
                    where jsonb_typeof(exception_outcome.value) = 'object'
                        and exception_outcome.value->>'outcome' in (
                            'deferred', 'failed', 'cancelled'
                        )
                        and exception_outcome.value->>'reason' in (
                            'customer-unavailable',
                            'address-inaccessible',
                            'address-wrong',
                            'harvest-damaged',
                            'harvest-missing',
                            'cancellation',
                            'operational-other'
                        )
                ),
                '[]'::jsonb
            )
            else '[]'::jsonb
        end
        else '[]'::jsonb
    end
`;

export async function getDeliveryOperationalHealth({
    diagnosticLimit: requestedDiagnosticLimit,
    from,
    now,
    to,
}: {
    diagnosticLimit?: number;
    from?: Date;
    now?: Date;
    to?: Date;
} = {}): Promise<DeliveryOperationalHealth> {
    const window = normalizedWindow({ from, now, to });
    const [
        runRows,
        pickupRows,
        handoffRows,
        exceptionOperations,
        stopOperationRows,
    ] = await Promise.all([
        storage()
            .select({
                completedAt: deliveryRuns.completedAt,
                currentLocationReceivedAt:
                    deliveryRuns.currentLocationReceivedAt,
                estimateSource: deliveryRuns.estimateSource,
                estimatesUpdatedAt: deliveryRuns.estimatesUpdatedAt,
                id: deliveryRuns.id,
                rerouteAttemptedAt: deliveryRuns.rerouteAttemptedAt,
                rerouteRequiredAt: deliveryRuns.rerouteRequiredAt,
                routePlanVersion: deliveryRuns.routePlanVersion,
                startedAt: deliveryRuns.startedAt,
                state: deliveryRuns.state,
                updatedAt: deliveryRuns.updatedAt,
            })
            .from(deliveryRuns)
            .where(relevantDeliveryRunCondition(window.from, window.to)),
        storage()
            .select({
                appliedAt: deliveryRunPickupOperations.appliedAt,
                occurredAt: deliveryRunPickupOperations.occurredAt,
                runId: deliveryRunPickupOperations.runId,
            })
            .from(deliveryRunPickupOperations)
            .innerJoin(
                deliveryRuns,
                eq(deliveryRunPickupOperations.runId, deliveryRuns.id),
            )
            .where(
                and(
                    relevantDeliveryRunCondition(window.from, window.to),
                    gte(deliveryRunPickupOperations.appliedAt, window.from),
                    lte(deliveryRunPickupOperations.appliedAt, window.to),
                ),
            ),
        storage()
            .select({
                appliedAt: deliveryRunHandoffOperations.appliedAt,
                occurredAt: deliveryRunHandoffOperations.occurredAt,
                runId: deliveryRunHandoffOperations.runId,
            })
            .from(deliveryRunHandoffOperations)
            .innerJoin(
                deliveryRuns,
                eq(deliveryRunHandoffOperations.runId, deliveryRuns.id),
            )
            .where(
                and(
                    relevantDeliveryRunCondition(window.from, window.to),
                    gte(deliveryRunHandoffOperations.appliedAt, window.from),
                    lte(deliveryRunHandoffOperations.appliedAt, window.to),
                ),
            ),
        storage()
            .select({
                appliedAt: deliveryRunExceptionOperations.appliedAt,
                occurredAt: deliveryRunExceptionOperations.occurredAt,
                outcomes: deliveryOperationalExceptionOutcomesProjection,
                runId: deliveryRunExceptionOperations.runId,
            })
            .from(deliveryRunExceptionOperations)
            .innerJoin(
                deliveryRuns,
                eq(deliveryRunExceptionOperations.runId, deliveryRuns.id),
            )
            .where(
                and(
                    relevantDeliveryRunCondition(window.from, window.to),
                    gte(deliveryRunExceptionOperations.appliedAt, window.from),
                    lte(deliveryRunExceptionOperations.appliedAt, window.to),
                ),
            ),
        storage()
            .select({
                appliedAt: deliveryRunStopOperations.appliedAt,
                occurredAt: deliveryRunStopOperations.occurredAt,
                runId: deliveryRunStopOperations.runId,
            })
            .from(deliveryRunStopOperations)
            .innerJoin(
                deliveryRuns,
                eq(deliveryRunStopOperations.runId, deliveryRuns.id),
            )
            .where(
                and(
                    relevantDeliveryRunCondition(window.from, window.to),
                    gte(deliveryRunStopOperations.appliedAt, window.from),
                    lte(deliveryRunStopOperations.appliedAt, window.to),
                ),
            ),
    ]);

    const exceptionSamples = exceptionOperations.flatMap((row) =>
        row.occurredAt >= window.from && row.occurredAt <= window.to
            ? deliveryOperationalExceptionSamplesFromProjection({
                  occurredAt: row.occurredAt,
                  outcomes: row.outcomes,
                  runId: row.runId,
              })
            : [],
    );
    const runSamples = runRows.flatMap((row) =>
        isDeliveryRunState(row.state) ? [{ ...row, state: row.state }] : [],
    );
    const replaySamples: DeliveryOperationalReplaySample[] = [
        ...pickupRows.map((row) => ({ ...row, kind: 'pickup' as const })),
        ...handoffRows.map((row) => ({ ...row, kind: 'handoff' as const })),
        ...exceptionOperations.map((row) => ({
            appliedAt: row.appliedAt,
            kind: 'exception' as const,
            occurredAt: row.occurredAt,
            runId: row.runId,
        })),
        ...stopOperationRows.map((row) => ({
            ...row,
            kind: 'stop' as const,
        })),
    ];

    return projectDeliveryOperationalHealth({
        diagnosticLimit: requestedDiagnosticLimit,
        exceptionSamples,
        replaySamples,
        runSamples,
        ...window,
    });
}
