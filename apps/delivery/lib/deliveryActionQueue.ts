import type {
    DeliveryRunHandoffItemState,
    DeliveryRunHandoffSkipReason,
} from '@gredice/storage';
import type {
    DeliveryExceptionOutcome,
    DeliveryExceptionReason,
} from './deliveryDashboardTypes';
import { assertDeliveryOfflineWritesAllowed } from './deliveryOfflineEvents';
import { normalizeHarvestTraceScanValue } from './harvestTraceScan';

export type DeliveryActionQueueScope = {
    userId: string;
    runId: string;
};

type DeliveryRouteCommandBase = {
    operationId: string;
    runId: string;
    stopId: number;
    occurredAt: string;
    expectedRouteRevision: number;
};

export type DeliveryArriveCommand = DeliveryRouteCommandBase & {
    kind: 'arrive';
};

export type DeliveryCompleteCommand = DeliveryRouteCommandBase & {
    kind: 'deliver';
    notes?: string;
};

export type DeliveryExceptionCommand = DeliveryRouteCommandBase & {
    kind: 'exception';
    exceptions: Array<{
        stopId: number;
        outcome: DeliveryExceptionOutcome;
        reason: DeliveryExceptionReason;
        note?: string;
    }>;
};

type DeliveryHandoffCommandBase = {
    operationId: string;
    runId: string;
    stopId: number;
    expectedRetryAttempt: number;
    occurredAt: string;
};

export type DeliveryVerificationScanCommand = DeliveryHandoffCommandBase & {
    kind: 'verification-scan';
    tracePath: string;
};

export type DeliveryVerificationMarkCommand = DeliveryHandoffCommandBase & {
    kind: 'verification-mark';
    itemStopId: number;
    outcome: 'no-label' | 'missing' | 'skipped';
    reason?: DeliveryRunHandoffSkipReason;
};

export type DeliveryHandoffCommand =
    | DeliveryVerificationScanCommand
    | DeliveryVerificationMarkCommand;

export type DeliveryActionCommand =
    | DeliveryArriveCommand
    | DeliveryCompleteCommand
    | DeliveryExceptionCommand
    | DeliveryHandoffCommand;

export type DeliveryRouteActionCommand = Exclude<
    DeliveryActionCommand,
    DeliveryHandoffCommand
>;

export type DeliveryServerActionCommand = DeliveryActionCommand;

export type DeliveryActionCommandState =
    | 'queued'
    | 'sending'
    | 'reconciling'
    | 'synced'
    | 'failed'
    | 'conflicted';

export type DeliveryRouteActionAcknowledgement = {
    kind: 'server';
    replayed: boolean;
    routeRevision?: number;
    reroutePending?: boolean;
    runCompleted?: boolean;
};

export type DeliveryHandoffOperationOutcome =
    | 'applied'
    | 'already-applied'
    | 'stale'
    | 'invalid'
    | 'wrong-stop'
    | 'item-not-found';

export type DeliveryHandoffOperationResult = {
    kind: 'scan' | 'mark-item';
    outcome: DeliveryHandoffOperationOutcome;
    affectedStopIds: number[];
    itemState?: DeliveryRunHandoffItemState;
    reason?: DeliveryRunHandoffSkipReason;
};

export type DeliveryHandoffActionAcknowledgement = {
    kind: 'handoff';
    replayed: boolean;
    retryAttempt: number;
    result: DeliveryHandoffOperationResult;
    routeRevision?: undefined;
    reroutePending?: undefined;
    runCompleted?: undefined;
};

export type DeliveryActionAcknowledgement =
    | DeliveryRouteActionAcknowledgement
    | DeliveryHandoffActionAcknowledgement;

export type DeliveryActionQueueEntry = {
    sequence: number;
    command: DeliveryActionCommand;
    state: DeliveryActionCommandState;
    attemptCount: number;
    createdAt: string;
    updatedAt: string;
    acknowledgement?: DeliveryActionAcknowledgement;
    errorCode?: string;
};

export type DeliveryActionQueueDurability = 'durable' | 'memory';
export type DeliveryActionQueueCoordination = 'coordinated' | 'best-effort';

export type DeliveryActionQueueSnapshot = {
    scope: DeliveryActionQueueScope;
    durability: DeliveryActionQueueDurability;
    coordination: DeliveryActionQueueCoordination;
    entries: readonly DeliveryActionQueueEntry[];
    queuedCount: number;
    sendingCount: number;
    reconcilingCount: number;
    syncedCount: number;
    failedCount: number;
    conflictedCount: number;
};

export type DeliveryActionTransportResult =
    | {
          status: 'applied';
          routeRevision: number;
          reroutePending: boolean;
          runCompleted: boolean;
      }
    | {
          status: 'exact-duplicate';
          routeRevision: number;
          reroutePending: boolean;
          runCompleted: boolean;
      }
    | {
          status: 'handoff-acknowledged';
          replayed: boolean;
          retryAttempt: number;
          result: DeliveryHandoffOperationResult;
      }
    | { status: 'retryable-failure'; code?: string }
    | { status: 'permanent-failure'; code?: string };

export type DeliveryActionTransport = (
    command: DeliveryServerActionCommand,
) => Promise<DeliveryActionTransportResult>;

export type DeliveryActionQueuePersistence = {
    readonly durability: DeliveryActionQueueDurability;
    readonly durableCleanupRequired?: boolean;
    load: (scope: DeliveryActionQueueScope) => Promise<unknown>;
    save: (
        scope: DeliveryActionQueueScope,
        entries: readonly DeliveryActionQueueEntry[],
    ) => Promise<void>;
    clear: (scope: { userId: string; runId?: string }) => Promise<void>;
    clearOtherRuns?: (scope: {
        userId: string;
        activeRunId: string;
    }) => Promise<void>;
};

export type DeliveryActionQueueCoordinator = {
    runExclusive: <Result>(
        scope: DeliveryActionQueueScope,
        task: () => Promise<Result>,
    ) => Promise<Result>;
};

type DeliveryActionQueueOptions = {
    scope: DeliveryActionQueueScope;
    persistence: DeliveryActionQueuePersistence;
    transport: DeliveryActionTransport;
    coordinator?: DeliveryActionQueueCoordinator;
    replayCoordinator?: DeliveryActionQueueCoordinator;
    crossTabNotifications?: boolean;
    now?: () => Date;
};

type DeliveryRouteCommandInput = {
    operationId: string;
    runId: string;
    stopId: number;
    expectedRouteRevision: number;
    occurredAt?: string;
    now?: () => Date;
};

type DeliveryHandoffCommandInput = {
    operationId: string;
    runId: string;
    stopId: number;
    expectedRetryAttempt: number;
    occurredAt?: string;
    now?: () => Date;
};

const persistenceVersion = 1;
export const deliveryActionQueueTtlMs = 24 * 60 * 60 * 1_000;
const maximumPersistedEntries = 200;
const databaseName = 'gredice-delivery-actions-v1';
const storeName = 'run-actions';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
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
    return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function validHandoffStopId(value: unknown): value is number {
    return (
        validStopId(value) &&
        Number.isSafeInteger(value) &&
        value <= 2_147_483_647
    );
}

function validRevision(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function validRetryAttempt(value: unknown): value is number {
    return (
        typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    );
}

function validDate(value: unknown): value is string {
    return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function validHandoffDate(value: unknown): value is string {
    return (
        typeof value === 'string' &&
        /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(?:Z|[+-](\d{2}):(\d{2}))$/.test(
            value,
        ) &&
        Number.isFinite(Date.parse(value))
    );
}

function validErrorCode(value: unknown): value is string {
    return (
        typeof value === 'string' &&
        value.length > 0 &&
        value.length <= 128 &&
        /^[a-z0-9-]+$/.test(value)
    );
}

function validNote(value: unknown): value is string | undefined {
    return (
        value === undefined ||
        (typeof value === 'string' && value.length <= 1_000)
    );
}

function validReason(value: unknown): value is DeliveryExceptionReason {
    return (
        value === 'customer-unavailable' ||
        value === 'address-inaccessible' ||
        value === 'address-wrong' ||
        value === 'harvest-damaged' ||
        value === 'harvest-missing' ||
        value === 'cancellation' ||
        value === 'operational-other'
    );
}

function validOutcome(value: unknown): value is DeliveryExceptionOutcome {
    return value === 'deferred' || value === 'failed' || value === 'cancelled';
}

function validHandoffOperationId(value: unknown): value is string {
    return typeof value === 'string' && /^[A-Za-z0-9_-]{8,128}$/.test(value);
}

function validTracePath(value: unknown): value is string {
    return (
        typeof value === 'string' &&
        value.length <= 2_048 &&
        normalizeHarvestTraceScanValue(value) === value
    );
}

function validHandoffState(
    value: unknown,
): value is DeliveryRunHandoffItemState {
    return (
        value === 'unverified' ||
        value === 'scanned' ||
        value === 'no-label' ||
        value === 'missing' ||
        value === 'skipped'
    );
}

function validHandoffSkipReason(
    value: unknown,
): value is DeliveryRunHandoffSkipReason {
    return (
        value === 'scanner-unavailable' ||
        value === 'label-unreadable' ||
        value === 'manual-verification' ||
        value === 'other-operational'
    );
}

function validHandoffOutcome(
    value: unknown,
): value is DeliveryHandoffOperationOutcome {
    return (
        value === 'applied' ||
        value === 'already-applied' ||
        value === 'stale' ||
        value === 'invalid' ||
        value === 'wrong-stop' ||
        value === 'item-not-found'
    );
}

function validException(value: unknown) {
    return (
        isRecord(value) &&
        validStopId(value.stopId) &&
        validOutcome(value.outcome) &&
        validReason(value.reason) &&
        validNote(value.note)
    );
}

export function isDeliveryHandoffCommand(
    value: unknown,
): value is DeliveryHandoffCommand {
    if (
        !isRecord(value) ||
        (value.kind !== 'verification-scan' &&
            value.kind !== 'verification-mark') ||
        !validHandoffOperationId(value.operationId) ||
        !validIdentifier(value.runId) ||
        !validHandoffStopId(value.stopId) ||
        !validRetryAttempt(value.expectedRetryAttempt) ||
        !validHandoffDate(value.occurredAt)
    ) {
        return false;
    }
    if (value.kind === 'verification-scan') {
        return validTracePath(value.tracePath);
    }
    if (
        !validHandoffStopId(value.itemStopId) ||
        (value.outcome !== 'no-label' &&
            value.outcome !== 'missing' &&
            value.outcome !== 'skipped')
    ) {
        return false;
    }
    return value.outcome === 'skipped'
        ? validHandoffSkipReason(value.reason)
        : value.reason === undefined;
}

function isDeliveryActionCommand(
    value: unknown,
): value is DeliveryActionCommand {
    if (
        !isRecord(value) ||
        !validIdentifier(value.operationId) ||
        !validIdentifier(value.runId) ||
        !validStopId(value.stopId) ||
        !validDate(value.occurredAt)
    ) {
        return false;
    }
    if (isDeliveryHandoffCommand(value)) return true;
    if (!validRevision(value.expectedRouteRevision)) return false;
    if (value.kind === 'arrive') return true;
    if (value.kind === 'deliver') return validNote(value.notes);
    return (
        value.kind === 'exception' &&
        Array.isArray(value.exceptions) &&
        value.exceptions.length > 0 &&
        value.exceptions.length <= 100 &&
        value.exceptions.every(validException)
    );
}

function isHandoffOperationResult(
    value: unknown,
): value is DeliveryHandoffOperationResult {
    return (
        isRecord(value) &&
        (value.kind === 'scan' || value.kind === 'mark-item') &&
        validHandoffOutcome(value.outcome) &&
        Array.isArray(value.affectedStopIds) &&
        value.affectedStopIds.every(validStopId) &&
        new Set(value.affectedStopIds).size === value.affectedStopIds.length &&
        (value.itemState === undefined || validHandoffState(value.itemState)) &&
        (value.reason === undefined || validHandoffSkipReason(value.reason))
    );
}

function handoffAcknowledgementMatchesCommand(
    command: DeliveryHandoffCommand,
    acknowledgement: DeliveryHandoffActionAcknowledgement,
) {
    const result = acknowledgement.result;
    if (
        acknowledgement.retryAttempt !== command.expectedRetryAttempt ||
        result.kind !==
            (command.kind === 'verification-scan' ? 'scan' : 'mark-item')
    ) {
        return false;
    }
    const emptyOutcome =
        result.outcome === 'invalid' ||
        result.outcome === 'wrong-stop' ||
        result.outcome === 'item-not-found';
    if (emptyOutcome) {
        return (
            result.affectedStopIds.length === 0 &&
            result.itemState === undefined &&
            result.reason === undefined &&
            (result.outcome === 'wrong-stop' ||
                (command.kind === 'verification-scan' &&
                    result.outcome === 'invalid') ||
                (command.kind === 'verification-mark' &&
                    result.outcome === 'item-not-found'))
        );
    }
    if (result.affectedStopIds.length === 0) return false;
    if (command.kind === 'verification-scan') {
        return result.itemState === 'scanned' && result.reason === undefined;
    }
    return (
        result.affectedStopIds.length === 1 &&
        result.affectedStopIds[0] === command.itemStopId &&
        result.itemState === command.outcome &&
        result.reason ===
            (command.outcome === 'skipped' ? command.reason : undefined)
    );
}

function isAcknowledgement(
    value: unknown,
): value is DeliveryActionAcknowledgement {
    if (!isRecord(value) || typeof value.replayed !== 'boolean') return false;
    if (value.kind === 'handoff') {
        return (
            validRetryAttempt(value.retryAttempt) &&
            isHandoffOperationResult(value.result)
        );
    }
    return (
        value.kind === 'server' &&
        (value.routeRevision === undefined ||
            validRevision(value.routeRevision)) &&
        (value.reroutePending === undefined ||
            typeof value.reroutePending === 'boolean') &&
        (value.runCompleted === undefined ||
            typeof value.runCompleted === 'boolean')
    );
}

function isEntry(value: unknown): value is DeliveryActionQueueEntry {
    if (
        !(
            isRecord(value) &&
            typeof value.sequence === 'number' &&
            Number.isInteger(value.sequence) &&
            value.sequence >= 0 &&
            isDeliveryActionCommand(value.command) &&
            (value.state === 'queued' ||
                value.state === 'sending' ||
                value.state === 'reconciling' ||
                value.state === 'synced' ||
                value.state === 'failed' ||
                value.state === 'conflicted') &&
            typeof value.attemptCount === 'number' &&
            Number.isInteger(value.attemptCount) &&
            value.attemptCount >= 0 &&
            validDate(value.createdAt) &&
            validDate(value.updatedAt) &&
            (value.acknowledgement === undefined ||
                isAcknowledgement(value.acknowledgement)) &&
            (value.errorCode === undefined || validErrorCode(value.errorCode))
        )
    ) {
        return false;
    }
    if (value.acknowledgement?.kind === 'handoff') {
        return (
            isDeliveryHandoffCommand(value.command) &&
            value.state === 'synced' &&
            handoffAcknowledgementMatchesCommand(
                value.command,
                value.acknowledgement,
            )
        );
    }
    if (isDeliveryHandoffCommand(value.command)) {
        return value.state !== 'synced' && value.acknowledgement === undefined;
    }
    return (
        value.acknowledgement?.kind !== 'server' ||
        !isDeliveryHandoffCommand(value.command)
    );
}

function cloneValue<Value>(value: Value): Value {
    if (value === undefined) return value;
    return JSON.parse(JSON.stringify(value)) as Value;
}

function cloneEntry(entry: DeliveryActionQueueEntry) {
    return cloneValue(entry);
}

function fingerprint(command: DeliveryActionCommand) {
    return JSON.stringify(command);
}

function handoffSemanticFingerprint(command: DeliveryHandoffCommand) {
    return JSON.stringify(
        command.kind === 'verification-scan'
            ? {
                  kind: command.kind,
                  operationId: command.operationId,
                  runId: command.runId,
                  stopId: command.stopId,
                  expectedRetryAttempt: command.expectedRetryAttempt,
                  tracePath: command.tracePath,
              }
            : {
                  kind: command.kind,
                  operationId: command.operationId,
                  runId: command.runId,
                  stopId: command.stopId,
                  expectedRetryAttempt: command.expectedRetryAttempt,
                  itemStopId: command.itemStopId,
                  outcome: command.outcome,
                  reason: command.reason,
              },
    );
}

function monotonicHandoffCommand(
    command: DeliveryHandoffCommand,
    entries: readonly DeliveryActionQueueEntry[],
): DeliveryHandoffCommand {
    const previousOccurredAt = Math.max(
        -1,
        ...entries.flatMap((entry) =>
            isDeliveryHandoffCommand(entry.command) &&
            entry.command.runId === command.runId &&
            entry.command.stopId === command.stopId &&
            entry.command.expectedRetryAttempt === command.expectedRetryAttempt
                ? [Date.parse(entry.command.occurredAt)]
                : [],
        ),
    );
    const occurredAt = Date.parse(command.occurredAt);
    if (occurredAt > previousOccurredAt) return command;
    return {
        ...command,
        occurredAt: new Date(previousOccurredAt + 1).toISOString(),
    };
}

function resolvedOccurredAt(value: string | undefined, now: () => Date) {
    const result = value ?? now().toISOString();
    if (!validDate(result)) {
        throw new TypeError('Delivery action has an invalid occurredAt value');
    }
    return new Date(result).toISOString();
}

function validatedCommand<Command extends DeliveryActionCommand>(
    command: Command,
) {
    if (!isDeliveryActionCommand(command)) {
        throw new TypeError('Delivery action command is invalid');
    }
    return command;
}

export function createDeliveryArriveCommand({
    occurredAt,
    now = () => new Date(),
    ...input
}: DeliveryRouteCommandInput): DeliveryArriveCommand {
    return validatedCommand({
        ...input,
        kind: 'arrive',
        occurredAt: resolvedOccurredAt(occurredAt, now),
    });
}

export function createDeliveryCompleteCommand({
    notes,
    occurredAt,
    now = () => new Date(),
    ...input
}: DeliveryRouteCommandInput & { notes?: string }): DeliveryCompleteCommand {
    const normalizedNotes = notes?.trim();
    return validatedCommand({
        ...input,
        kind: 'deliver',
        occurredAt: resolvedOccurredAt(occurredAt, now),
        ...(normalizedNotes ? { notes: normalizedNotes } : {}),
    });
}

export function createDeliveryExceptionCommand({
    exceptions,
    occurredAt,
    now = () => new Date(),
    ...input
}: DeliveryRouteCommandInput & {
    exceptions: DeliveryExceptionCommand['exceptions'];
}): DeliveryExceptionCommand {
    return validatedCommand({
        ...input,
        kind: 'exception',
        occurredAt: resolvedOccurredAt(occurredAt, now),
        exceptions: cloneValue(exceptions),
    });
}

export function createDeliveryVerificationScanCommand({
    operationId,
    runId,
    stopId,
    expectedRetryAttempt,
    tracePath,
    occurredAt,
    now = () => new Date(),
}: DeliveryHandoffCommandInput & {
    tracePath: string;
}): DeliveryVerificationScanCommand {
    const trimmedTracePath = tracePath.trim();
    const normalizedTracePath =
        normalizeHarvestTraceScanValue(trimmedTracePath);
    return validatedCommand({
        kind: 'verification-scan',
        operationId,
        runId,
        stopId,
        expectedRetryAttempt,
        tracePath: normalizedTracePath ?? '',
        occurredAt: resolvedOccurredAt(occurredAt, now),
    });
}

export function createDeliveryVerificationMarkCommand({
    operationId,
    runId,
    stopId,
    expectedRetryAttempt,
    itemStopId,
    outcome,
    reason,
    occurredAt,
    now = () => new Date(),
}: DeliveryHandoffCommandInput & {
    itemStopId: number;
    outcome: DeliveryVerificationMarkCommand['outcome'];
    reason?: DeliveryRunHandoffSkipReason;
}): DeliveryVerificationMarkCommand {
    return validatedCommand({
        kind: 'verification-mark',
        operationId,
        runId,
        stopId,
        expectedRetryAttempt,
        itemStopId,
        outcome,
        ...(reason ? { reason } : {}),
        occurredAt: resolvedOccurredAt(occurredAt, now),
    });
}

export class DeliveryActionOperationConflictError extends Error {
    override name = 'DeliveryActionOperationConflictError';

    constructor(readonly operationId: string) {
        super(`Delivery action ${operationId} has conflicting payloads`);
    }
}

export class DeliveryActionBarrierError extends Error {
    override name = 'DeliveryActionBarrierError';

    constructor() {
        super(
            'An offline delivery exception must synchronize before continuing',
        );
    }
}

function persistenceKey(scope: DeliveryActionQueueScope) {
    return `${encodeURIComponent(scope.userId)}:${encodeURIComponent(scope.runId)}`;
}

function persistenceUserPrefix(userId: string) {
    return `${encodeURIComponent(userId)}:`;
}

function persistedPayload(entries: readonly DeliveryActionQueueEntry[]) {
    return { version: persistenceVersion, entries };
}

function restoredEntries(
    value: unknown,
    scope: DeliveryActionQueueScope,
    now: Date,
) {
    if (
        !isRecord(value) ||
        value.version !== persistenceVersion ||
        !Array.isArray(value.entries)
    ) {
        return [];
    }
    const minimumCreatedAt = now.getTime() - deliveryActionQueueTtlMs;
    const byOperationId = new Map<string, DeliveryActionQueueEntry>();
    for (const candidate of value.entries) {
        if (
            !isEntry(candidate) ||
            candidate.command.runId !== scope.runId ||
            Date.parse(candidate.createdAt) < minimumCreatedAt ||
            Date.parse(candidate.createdAt) > now.getTime() + 5 * 60 * 1_000
        ) {
            continue;
        }
        const restored = cloneEntry(candidate);
        if (restored.state === 'sending') restored.state = 'queued';
        const existing = byOperationId.get(restored.command.operationId);
        if (
            existing &&
            fingerprint(existing.command) !== fingerprint(restored.command)
        ) {
            throw new DeliveryActionOperationConflictError(
                restored.command.operationId,
            );
        }
        byOperationId.set(restored.command.operationId, restored);
    }
    return Array.from(byOperationId.values())
        .sort((first, second) => first.sequence - second.sequence)
        .slice(-maximumPersistedEntries);
}

function snapshotFor(
    scope: DeliveryActionQueueScope,
    entries: readonly DeliveryActionQueueEntry[],
    durability: DeliveryActionQueueDurability,
    coordination: DeliveryActionQueueCoordination,
): DeliveryActionQueueSnapshot {
    const cloned = entries.map(cloneEntry);
    return {
        scope: { ...scope },
        durability,
        coordination,
        entries: cloned,
        queuedCount: entries.filter((entry) => entry.state === 'queued').length,
        sendingCount: entries.filter((entry) => entry.state === 'sending')
            .length,
        reconcilingCount: entries.filter(
            (entry) => entry.state === 'reconciling',
        ).length,
        syncedCount: entries.filter((entry) => entry.state === 'synced').length,
        failedCount: entries.filter((entry) => entry.state === 'failed').length,
        conflictedCount: entries.filter((entry) => entry.state === 'conflicted')
            .length,
    };
}

export function deliveryActionPendingEntryForStop(
    snapshot: DeliveryActionQueueSnapshot | null,
    stopId: number,
) {
    const entries =
        snapshot?.entries.filter(
            (entry) =>
                !isDeliveryHandoffCommand(entry.command) &&
                entry.command.stopId === stopId &&
                (entry.state !== 'synced' ||
                    entry.acknowledgement?.kind === 'server'),
        ) ?? [];
    return (
        entries.find(
            (entry) => entry.state === 'failed' || entry.state === 'conflicted',
        ) ?? entries.at(-1)
    );
}

export function deliveryActionAcknowledgementBlocksRoute(
    entry: DeliveryActionQueueEntry | undefined,
) {
    return (
        entry?.acknowledgement?.kind === 'server' &&
        (entry.acknowledgement.reroutePending === true ||
            entry.acknowledgement.runCompleted === true)
    );
}

export function deliveryActionQueueCanReplay(
    snapshot: DeliveryActionQueueSnapshot,
) {
    return (
        snapshot.entries.some(
            (entry) =>
                entry.state === 'queued' ||
                (isDeliveryHandoffCommand(entry.command) &&
                    entry.state === 'failed'),
        ) &&
        !snapshot.entries.some(
            (entry) =>
                !isDeliveryHandoffCommand(entry.command) &&
                (entry.state === 'failed' ||
                    entry.state === 'conflicted' ||
                    entry.state === 'reconciling'),
        ) &&
        !snapshot.entries.some(deliveryActionAcknowledgementBlocksRoute)
    );
}

export function deliveryActionVerifiedTracePaths(
    snapshot: DeliveryActionQueueSnapshot | null,
    stopId: number,
    expectedRetryAttempt: number,
) {
    return (
        snapshot?.entries.flatMap((entry) =>
            entry.command.kind === 'verification-scan' &&
            entry.command.stopId === stopId &&
            entry.command.expectedRetryAttempt === expectedRetryAttempt &&
            entry.state !== 'conflicted' &&
            (entry.acknowledgement?.kind !== 'handoff' ||
                entry.acknowledgement.result.outcome === 'applied' ||
                entry.acknowledgement.result.outcome === 'already-applied')
                ? [entry.command.tracePath]
                : [],
        ) ?? []
    );
}

export function nextDeliveryActionRouteRevision(
    snapshot: DeliveryActionQueueSnapshot | null,
    serverRouteRevision: number,
) {
    let revision = serverRouteRevision;
    for (const entry of snapshot?.entries ?? []) {
        if (
            isDeliveryHandoffCommand(entry.command) ||
            entry.state === 'conflicted'
        ) {
            continue;
        }
        const acknowledgedRevision = entry.acknowledgement?.routeRevision;
        if (acknowledgedRevision !== undefined) {
            revision = Math.max(revision, acknowledgedRevision);
        } else if (entry.state !== 'synced') {
            revision += 1;
        }
    }
    return revision;
}

export function createMemoryDeliveryActionQueuePersistence(): DeliveryActionQueuePersistence {
    const values = new Map<string, unknown>();
    return {
        durability: 'memory',
        durableCleanupRequired: false,
        async load(scope) {
            return cloneValue(values.get(persistenceKey(scope)));
        },
        async save(scope, entries) {
            assertDeliveryOfflineWritesAllowed();
            values.set(
                persistenceKey(scope),
                cloneValue(persistedPayload(entries)),
            );
        },
        async clear(scope) {
            if (scope.runId) {
                values.delete(
                    persistenceKey({
                        userId: scope.userId,
                        runId: scope.runId,
                    }),
                );
                return;
            }
            for (const key of values.keys()) {
                if (key.startsWith(persistenceUserPrefix(scope.userId))) {
                    values.delete(key);
                }
            }
        },
        async clearOtherRuns({ userId, activeRunId }) {
            const prefix = persistenceUserPrefix(userId);
            const activeKey = persistenceKey({ userId, runId: activeRunId });
            for (const key of values.keys()) {
                if (key.startsWith(prefix) && key !== activeKey) {
                    values.delete(key);
                }
            }
        },
    };
}

function requestResult<Result>(request: IDBRequest<Result>) {
    return new Promise<Result>((resolve, reject) => {
        request.addEventListener('success', () => resolve(request.result), {
            once: true,
        });
        request.addEventListener('error', () => reject(request.error), {
            once: true,
        });
    });
}

function transactionResult(transaction: IDBTransaction) {
    return new Promise<void>((resolve, reject) => {
        transaction.addEventListener('complete', () => resolve(), {
            once: true,
        });
        transaction.addEventListener('abort', () => reject(transaction.error), {
            once: true,
        });
        transaction.addEventListener('error', () => reject(transaction.error), {
            once: true,
        });
    });
}

function openDatabase(factory: IDBFactory) {
    return new Promise<IDBDatabase>((resolve, reject) => {
        const request = factory.open(databaseName, 1);
        request.addEventListener('upgradeneeded', () => {
            if (!request.result.objectStoreNames.contains(storeName)) {
                request.result.createObjectStore(storeName);
            }
        });
        request.addEventListener('success', () => resolve(request.result), {
            once: true,
        });
        request.addEventListener('error', () => reject(request.error), {
            once: true,
        });
    });
}

export function createIndexedDbDeliveryActionQueuePersistence(
    factory: IDBFactory,
): DeliveryActionQueuePersistence {
    const memory = createMemoryDeliveryActionQueuePersistence();
    let durable = true;
    let databasePromise: Promise<IDBDatabase> | null = null;
    const database = () => (databasePromise ??= openDatabase(factory));
    const markDurableStoreUnavailable = () => {
        durable = false;
        if (databasePromise) {
            void databasePromise
                .then((openDatabase) => openDatabase.close())
                .catch(() => undefined);
        }
        databasePromise = null;
    };
    const fallback = async <Result>(
        durableTask: () => Promise<Result>,
        memoryTask: () => Promise<Result>,
    ) => {
        if (!durable) return await memoryTask();
        try {
            return await durableTask();
        } catch {
            markDurableStoreUnavailable();
            return await memoryTask();
        }
    };
    return {
        get durability() {
            return durable ? 'durable' : 'memory';
        },
        durableCleanupRequired: true,
        async load(scope) {
            return await fallback(
                async () => {
                    const db = await database();
                    const transaction = db.transaction(storeName, 'readonly');
                    const completed = transactionResult(transaction);
                    const value: unknown = await requestResult(
                        transaction
                            .objectStore(storeName)
                            .get(persistenceKey(scope)),
                    );
                    await completed;
                    if (value !== undefined) {
                        const rawEntries =
                            isRecord(value) && Array.isArray(value.entries)
                                ? value.entries.filter(isEntry)
                                : [];
                        await memory.save(scope, rawEntries);
                    }
                    return value;
                },
                async () => await memory.load(scope),
            );
        },
        async save(scope, entries) {
            await memory.save(scope, entries);
            await fallback(
                async () => {
                    const db = await database();
                    assertDeliveryOfflineWritesAllowed();
                    const transaction = db.transaction(storeName, 'readwrite');
                    const completed = transactionResult(transaction);
                    transaction
                        .objectStore(storeName)
                        .put(persistedPayload(entries), persistenceKey(scope));
                    await completed;
                },
                async () => undefined,
            );
        },
        async clear(scope) {
            try {
                const db = await database();
                const transaction = db.transaction(storeName, 'readwrite');
                const completed = transactionResult(transaction);
                const store = transaction.objectStore(storeName);
                if (scope.runId) {
                    store.delete(
                        persistenceKey({
                            userId: scope.userId,
                            runId: scope.runId,
                        }),
                    );
                } else {
                    const keys = await requestResult(store.getAllKeys());
                    for (const key of keys) {
                        if (
                            typeof key === 'string' &&
                            key.startsWith(persistenceUserPrefix(scope.userId))
                        ) {
                            store.delete(key);
                        }
                    }
                }
                await completed;
                await memory.clear(scope);
                durable = true;
            } catch {
                markDurableStoreUnavailable();
                throw new Error(
                    'Durable delivery action cleanup could not be confirmed',
                );
            }
        },
        async clearOtherRuns({ userId, activeRunId }) {
            try {
                const db = await database();
                const transaction = db.transaction(storeName, 'readwrite');
                const completed = transactionResult(transaction);
                const store = transaction.objectStore(storeName);
                const keys = await requestResult(store.getAllKeys());
                const prefix = persistenceUserPrefix(userId);
                const activeKey = persistenceKey({
                    userId,
                    runId: activeRunId,
                });
                for (const key of keys) {
                    if (
                        typeof key === 'string' &&
                        key.startsWith(prefix) &&
                        key !== activeKey
                    ) {
                        store.delete(key);
                    }
                }
                await completed;
                await memory.clearOtherRuns?.({ userId, activeRunId });
                durable = true;
            } catch {
                markDurableStoreUnavailable();
                throw new Error(
                    'Durable delivery action cleanup could not be confirmed',
                );
            }
        },
    };
}

export function createBrowserDeliveryActionQueuePersistence() {
    try {
        return typeof indexedDB === 'undefined'
            ? createMemoryDeliveryActionQueuePersistence()
            : createIndexedDbDeliveryActionQueuePersistence(indexedDB);
    } catch {
        const memory = createMemoryDeliveryActionQueuePersistence();
        return {
            ...memory,
            durableCleanupRequired: true,
            async clear() {
                throw new Error(
                    'Durable delivery action cleanup could not be confirmed',
                );
            },
            async clearOtherRuns() {
                throw new Error(
                    'Durable delivery action cleanup could not be confirmed',
                );
            },
        };
    }
}

export async function clearOtherDeliveryActionQueueScopes(
    persistence: DeliveryActionQueuePersistence,
    scope: { userId: string; activeRunId: string },
) {
    await persistence.clearOtherRuns?.(scope);
}

export class DeliveryActionQueue {
    private entries: DeliveryActionQueueEntry[] = [];
    private snapshot: DeliveryActionQueueSnapshot;
    private readonly serverSnapshot: DeliveryActionQueueSnapshot;
    private readonly listeners = new Set<() => void>();
    private operationChain: Promise<void> = Promise.resolve();
    private replayPromise: Promise<DeliveryActionQueueSnapshot> | null = null;
    private nextSequence = 0;
    private generation = 0;
    private readonly now: () => Date;

    constructor(private readonly options: DeliveryActionQueueOptions) {
        if (
            !validIdentifier(options.scope.userId) ||
            !validIdentifier(options.scope.runId)
        ) {
            throw new TypeError('Delivery action queue scope is invalid');
        }
        this.now = options.now ?? (() => new Date());
        this.snapshot = snapshotFor(
            options.scope,
            [],
            options.persistence.durability,
            options.persistence.durability === 'durable' &&
                options.coordinator &&
                options.replayCoordinator &&
                options.crossTabNotifications
                ? 'coordinated'
                : 'best-effort',
        );
        this.serverSnapshot = snapshotFor(
            options.scope,
            [],
            'memory',
            'best-effort',
        );
    }

    getSnapshot = () => this.snapshot;
    getServerSnapshot = () => this.serverSnapshot;

    subscribe = (listener: () => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };

    async restore() {
        return await this.runExclusive(async () => {
            await this.load();
            await this.persist();
            return this.snapshot;
        });
    }

    async enqueue(command: DeliveryActionCommand) {
        if (
            !isDeliveryActionCommand(command) ||
            command.runId !== this.options.scope.runId
        ) {
            throw new TypeError('Delivery action does not match its queue');
        }
        return await this.runExclusive(async () => {
            await this.load();
            return await this.enqueueLoaded(command);
        });
    }

    async enqueueRouteAction(
        serverRouteRevision: number,
        createCommand: (
            expectedRouteRevision: number,
        ) => DeliveryRouteActionCommand,
    ) {
        if (!validRevision(serverRouteRevision)) {
            throw new TypeError('Server route revision is invalid');
        }
        return await this.runExclusive(async () => {
            await this.load();
            const command = createCommand(
                nextDeliveryActionRouteRevision(
                    this.snapshot,
                    serverRouteRevision,
                ),
            );
            if (
                !isDeliveryActionCommand(command) ||
                command.runId !== this.options.scope.runId
            ) {
                throw new TypeError('Delivery action does not match its queue');
            }
            return await this.enqueueLoaded(command);
        });
    }

    private async enqueueLoaded(inputCommand: DeliveryActionCommand) {
        const exact = this.entries.find(
            (entry) => entry.command.operationId === inputCommand.operationId,
        );
        if (exact) {
            const queueNormalizedReplay =
                isDeliveryHandoffCommand(exact.command) &&
                isDeliveryHandoffCommand(inputCommand) &&
                handoffSemanticFingerprint(exact.command) ===
                    handoffSemanticFingerprint(inputCommand) &&
                Date.parse(inputCommand.occurredAt) <=
                    Date.parse(exact.command.occurredAt);
            if (
                fingerprint(exact.command) !== fingerprint(inputCommand) &&
                !queueNormalizedReplay
            ) {
                throw new DeliveryActionOperationConflictError(
                    inputCommand.operationId,
                );
            }
            return cloneEntry(exact);
        }
        const command = isDeliveryHandoffCommand(inputCommand)
            ? monotonicHandoffCommand(inputCommand, this.entries)
            : inputCommand;
        if (isDeliveryHandoffCommand(command)) {
            const latestHandoff = this.entries
                .filter(
                    (entry) =>
                        isDeliveryHandoffCommand(entry.command) &&
                        entry.command.stopId === command.stopId &&
                        entry.command.expectedRetryAttempt ===
                            command.expectedRetryAttempt,
                )
                .at(-1);
            const latestCommand = latestHandoff?.command;
            const semanticDuplicate =
                (command.kind === 'verification-scan' &&
                    latestCommand?.kind === 'verification-scan' &&
                    latestCommand.tracePath === command.tracePath) ||
                (command.kind === 'verification-mark' &&
                    latestCommand?.kind === 'verification-mark' &&
                    latestCommand.itemStopId === command.itemStopId &&
                    latestCommand.outcome === command.outcome &&
                    latestCommand.reason === command.reason);
            if (latestHandoff && semanticDuplicate) {
                return cloneEntry(latestHandoff);
            }
        } else {
            if (
                this.entries.some(
                    (entry) =>
                        !isDeliveryHandoffCommand(entry.command) &&
                        (entry.state === 'failed' ||
                            entry.state === 'conflicted' ||
                            entry.state === 'reconciling' ||
                            deliveryActionAcknowledgementBlocksRoute(entry)),
                )
            ) {
                throw new DeliveryActionBarrierError();
            }
            if (command.kind === 'arrive' || command.kind === 'deliver') {
                const existingRouteAction = this.entries.find(
                    (entry) =>
                        entry.command.kind === command.kind &&
                        entry.command.stopId === command.stopId &&
                        entry.state !== 'synced' &&
                        entry.state !== 'conflicted',
                );
                if (existingRouteAction) {
                    return cloneEntry(existingRouteAction);
                }
            }
            if (
                this.entries.some(
                    (entry) =>
                        !isDeliveryHandoffCommand(entry.command) &&
                        entry.command.kind === 'exception',
                )
            ) {
                throw new DeliveryActionBarrierError();
            }
        }
        const timestamp = this.now().toISOString();
        const entry: DeliveryActionQueueEntry = {
            sequence: this.nextSequence,
            command: cloneValue(command),
            state: 'queued',
            attemptCount: 0,
            createdAt: timestamp,
            updatedAt: timestamp,
        };
        this.nextSequence += 1;
        this.entries.push(entry);
        this.trim();
        await this.persist();
        return cloneEntry(entry);
    }

    async replay() {
        if (this.replayPromise) return await this.replayPromise;
        const generation = this.generation;
        const task = () => this.replayEntries(generation);
        this.replayPromise = (
            this.options.replayCoordinator
                ? this.options.replayCoordinator.runExclusive(
                      this.options.scope,
                      task,
                  )
                : task()
        ).finally(() => {
            this.replayPromise = null;
        });
        return await this.replayPromise;
    }

    async retry(operationId: string) {
        return await this.runExclusive(async () => {
            await this.load();
            const entry = this.entries.find(
                (candidate) => candidate.command.operationId === operationId,
            );
            if (entry?.state !== 'failed') return false;
            entry.state = 'queued';
            entry.updatedAt = this.now().toISOString();
            delete entry.errorCode;
            delete entry.acknowledgement;
            await this.persist();
            return true;
        });
    }

    async completeServerReconciliation(operationId: string) {
        return await this.runExclusive(async () => {
            await this.load();
            const entry = this.entries.find(
                (candidate) => candidate.command.operationId === operationId,
            );
            if (
                !entry ||
                isDeliveryHandoffCommand(entry.command) ||
                entry.acknowledgement?.kind !== 'server'
            ) {
                return false;
            }
            this.entries = this.entries.filter(
                (candidate) => candidate.command.operationId !== operationId,
            );
            await this.persist();
            return true;
        });
    }

    async completeHandoffReconciliation({
        stopId,
        expectedRetryAttempt,
        operationIds,
    }: {
        stopId: number;
        expectedRetryAttempt: number;
        operationIds: readonly string[];
    }) {
        if (
            !validHandoffStopId(stopId) ||
            !validRetryAttempt(expectedRetryAttempt) ||
            operationIds.some(
                (operationId) => !validHandoffOperationId(operationId),
            ) ||
            new Set(operationIds).size !== operationIds.length
        ) {
            throw new TypeError('Delivery handoff reconciliation is invalid');
        }
        const reconciledOperationIds = new Set(operationIds);
        return await this.runExclusive(async () => {
            await this.load();
            const before = this.entries.length;
            this.entries = this.entries.filter(
                (entry) =>
                    !isDeliveryHandoffCommand(entry.command) ||
                    entry.command.stopId !== stopId ||
                    entry.command.expectedRetryAttempt !==
                        expectedRetryAttempt ||
                    entry.state !== 'synced' ||
                    !reconciledOperationIds.has(entry.command.operationId),
            );
            if (this.entries.length === before) return 0;
            await this.persist();
            return before - this.entries.length;
        });
    }

    async discardConflictAndDependents(operationId: string) {
        return await this.runExclusive(async () => {
            await this.load();
            const conflicted = this.entries.find(
                (entry) => entry.command.operationId === operationId,
            );
            if (conflicted?.state !== 'conflicted') return false;
            if (isDeliveryHandoffCommand(conflicted.command)) {
                this.entries = this.entries.filter(
                    (entry) => entry.command.operationId !== operationId,
                );
                await this.persist();
                return true;
            }
            this.entries = this.entries.filter(
                (entry) =>
                    isDeliveryHandoffCommand(entry.command) ||
                    entry.sequence < conflicted.sequence,
            );
            await this.persist();
            return true;
        });
    }

    async clear() {
        return await this.runExclusive(async () => {
            const requiredDurability =
                this.options.persistence.durableCleanupRequired ??
                this.options.persistence.durability === 'durable';
            try {
                await this.options.persistence.clear(this.options.scope);
            } catch (error) {
                this.publish();
                throw error;
            }
            if (
                requiredDurability &&
                this.options.persistence.durability !== 'durable'
            ) {
                this.publish();
                throw new Error(
                    'Durable delivery action cleanup could not be confirmed',
                );
            }
            this.generation += 1;
            this.entries = [];
            this.nextSequence = 0;
            this.publish();
        });
    }

    private runExclusive<Result>(task: () => Promise<Result>) {
        const coordinatedTask = () =>
            this.options.coordinator
                ? this.options.coordinator.runExclusive(
                      this.options.scope,
                      task,
                  )
                : task();
        const result = this.operationChain.then(
            coordinatedTask,
            coordinatedTask,
        );
        this.operationChain = result.then(
            () => undefined,
            () => undefined,
        );
        return result;
    }

    private async load() {
        this.entries = restoredEntries(
            await this.options.persistence.load(this.options.scope),
            this.options.scope,
            this.now(),
        );
        this.nextSequence =
            Math.max(-1, ...this.entries.map((entry) => entry.sequence)) + 1;
        this.publish();
    }

    private async replayEntries(generation: number) {
        const attemptedHandoffOperationIds = new Set<string>();
        while (generation === this.generation) {
            const command = await this.runExclusive(async () => {
                await this.load();
                if (
                    this.entries.some(deliveryActionAcknowledgementBlocksRoute)
                ) {
                    return null;
                }
                const entry = this.entries.find((candidate) => {
                    if (candidate.state === 'synced') return false;
                    if (!isDeliveryHandoffCommand(candidate.command)) {
                        return true;
                    }
                    if (
                        candidate.state === 'conflicted' ||
                        candidate.state === 'reconciling'
                    ) {
                        return false;
                    }
                    return !attemptedHandoffOperationIds.has(
                        candidate.command.operationId,
                    );
                });
                if (!entry) return null;
                if (
                    !isDeliveryHandoffCommand(entry.command) &&
                    (entry.state === 'failed' ||
                        entry.state === 'conflicted' ||
                        entry.state === 'reconciling')
                ) {
                    return null;
                }
                if (isDeliveryHandoffCommand(entry.command)) {
                    attemptedHandoffOperationIds.add(entry.command.operationId);
                }
                entry.state = 'sending';
                entry.attemptCount += 1;
                entry.updatedAt = this.now().toISOString();
                delete entry.errorCode;
                delete entry.acknowledgement;
                await this.persist();
                return cloneValue(entry.command);
            });
            if (!command) break;
            let result: DeliveryActionTransportResult;
            try {
                result = await this.options.transport(command);
            } catch {
                result = {
                    status: 'retryable-failure',
                    code: 'transport-error',
                };
            }
            const stop = await this.runExclusive(async () => {
                await this.load();
                const entry = this.entries.find(
                    (candidate) =>
                        candidate.command.operationId === command.operationId,
                );
                if (!entry || entry.state === 'synced') return false;
                entry.updatedAt = this.now().toISOString();
                const handoffCommand = isDeliveryHandoffCommand(command);
                if (
                    result.status === 'handoff-acknowledged' &&
                    handoffCommand
                ) {
                    entry.state = 'synced';
                    entry.acknowledgement = {
                        kind: 'handoff',
                        replayed: result.replayed,
                        retryAttempt: result.retryAttempt,
                        result: cloneValue(result.result),
                    };
                    delete entry.errorCode;
                } else if (
                    result.status === 'applied' ||
                    result.status === 'exact-duplicate'
                ) {
                    if (handoffCommand) {
                        entry.state = 'failed';
                        entry.errorCode = 'invalid-acknowledgement';
                    } else {
                        entry.state =
                            command.kind === 'exception'
                                ? 'reconciling'
                                : 'synced';
                        entry.acknowledgement = {
                            kind: 'server',
                            replayed: result.status === 'exact-duplicate',
                            routeRevision: result.routeRevision,
                            reroutePending: result.reroutePending,
                            runCompleted: result.runCompleted,
                        };
                        delete entry.errorCode;
                    }
                } else if (result.status === 'retryable-failure') {
                    entry.state = 'failed';
                    entry.errorCode = validErrorCode(result.code)
                        ? result.code
                        : handoffCommand
                          ? 'handoff-sync-failed'
                          : 'delivery-action-sync-failed';
                } else if (result.status === 'permanent-failure') {
                    entry.state = 'conflicted';
                    entry.errorCode = validErrorCode(result.code)
                        ? result.code
                        : handoffCommand
                          ? 'handoff-sync-conflict'
                          : 'delivery-action-conflict';
                } else {
                    entry.state = 'failed';
                    entry.errorCode = 'invalid-acknowledgement';
                }
                await this.persist();
                if (handoffCommand) return false;
                return (
                    entry.state === 'failed' ||
                    entry.state === 'conflicted' ||
                    entry.state === 'reconciling' ||
                    entry.acknowledgement?.reroutePending === true ||
                    entry.acknowledgement?.runCompleted === true
                );
            });
            if (stop) break;
        }
        return this.snapshot;
    }

    private trim() {
        if (this.entries.length <= maximumPersistedEntries) return;
        const removable = this.entries
            .filter((entry) => entry.state === 'synced')
            .sort((first, second) => first.sequence - second.sequence);
        for (const entry of removable) {
            if (this.entries.length <= maximumPersistedEntries) break;
            this.entries = this.entries.filter(
                (candidate) =>
                    candidate.command.operationId !== entry.command.operationId,
            );
        }
        if (this.entries.length > maximumPersistedEntries) {
            throw new RangeError('Too many unsynchronized delivery actions');
        }
    }

    private publish() {
        this.snapshot = snapshotFor(
            this.options.scope,
            this.entries,
            this.options.persistence.durability,
            this.options.persistence.durability === 'durable' &&
                this.options.coordinator &&
                this.options.replayCoordinator &&
                this.options.crossTabNotifications
                ? 'coordinated'
                : 'best-effort',
        );
        for (const listener of this.listeners) listener();
    }

    private async persist() {
        await this.options.persistence.save(
            this.options.scope,
            this.entries.map(cloneEntry),
        );
        this.publish();
    }
}
