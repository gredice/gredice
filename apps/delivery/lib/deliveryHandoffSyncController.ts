import type {
    DeliveryRunHandoffItemSnapshot,
    DeliveryRunHandoffManifest,
    DeliveryRunHandoffSkipReason,
} from '@gredice/storage';
import {
    type DeliveryActionQueueEntry,
    type DeliveryActionQueueSnapshot,
    isDeliveryHandoffCommand,
} from './deliveryActionQueue';
import type { DeliveryStopDeliverySummary } from './deliveryDashboardTypes';
import {
    type DeliveryHandoffManifest,
    type DeliveryHandoffManifestFetchResult,
    type DeliveryHandoffTraceItem,
    deliveryHandoffQueueEntries,
    projectDeliveryHandoffManifest,
} from './deliveryHandoffManifest';
import {
    createDeliveryHandoffManifestCacheRecord,
    type DeliveryHandoffManifestCachePersistence,
} from './deliveryHandoffManifestCache';
import type { DriverCommandResult } from './driverCommandResult';
import {
    type HarvestTraceVerificationResult,
    normalizeHarvestTraceScanValue,
    verifyDeliveryStopHarvestTrace,
} from './harvestTraceScan';

export type DeliveryHandoffTarget = {
    targetStopId: number;
    retryAttempt: number;
};

export type DeliveryHandoffItemSyncState =
    | 'persisted'
    | 'queued'
    | 'sending'
    | 'failed';

export type DeliveryHandoffSyncStatus =
    | 'idle'
    | 'loading'
    | 'ready'
    | 'offline'
    | 'syncing'
    | 'failed';

export type DeliveryHandoffManifestItemView = DeliveryRunHandoffItemSnapshot & {
    syncState?: DeliveryHandoffItemSyncState;
};

export type DeliveryHandoffManifestView = Omit<
    DeliveryRunHandoffManifest,
    'items'
> & {
    items: DeliveryHandoffManifestItemView[];
    syncState: Exclude<DeliveryHandoffSyncStatus, 'idle'>;
    pendingCount: number;
    error: string | null;
};

export type DeliveryHandoffFeedback = {
    operationId: string;
    kind:
        | 'stale'
        | 'invalid'
        | 'wrong-stop'
        | 'item-not-found'
        | 'sync-failed'
        | 'conflict';
    message: string;
};

export type DeliveryHandoffMarkInput = {
    itemStopId: number;
    outcome: 'no-label' | 'missing' | 'skipped';
    reason?: DeliveryRunHandoffSkipReason;
};

export type HarvestTraceScanFailureResult = {
    status: 'scan-failed';
    message: string;
};

export type DeliveryHandoffScanResult =
    | HarvestTraceVerificationResult
    | HarvestTraceScanFailureResult;

export type DeliveryHandoffActionSyncAdapter = {
    getSnapshot: () => DeliveryActionQueueSnapshot;
    syncNow: () => Promise<DeliveryActionQueueSnapshot>;
    enqueueVerificationScan: (
        targetStopId: number,
        tracePath: string,
        expectedRetryAttempt: number,
    ) => Promise<DeliveryActionQueueEntry>;
    enqueueVerificationMark: (input: {
        stopId: number;
        expectedRetryAttempt: number;
        itemStopId: number;
        outcome: 'no-label' | 'missing' | 'skipped';
        reason?: DeliveryRunHandoffSkipReason;
    }) => Promise<DeliveryActionQueueEntry>;
    completeHandoffReconciliation: (
        targetStopId: number,
        expectedRetryAttempt: number,
        operationIds: readonly string[],
    ) => Promise<number>;
};

export type DeliveryHandoffControllerState = {
    handoff: DeliveryHandoffManifestView | null;
    status: DeliveryHandoffSyncStatus;
    error: string | null;
    feedback: readonly DeliveryHandoffFeedback[];
};

type DeliveryHandoffControllerOptions = {
    userId: string;
    runId: string;
    cache: DeliveryHandoffManifestCachePersistence;
    actions: DeliveryHandoffActionSyncAdapter;
    fetchManifest: (input: {
        runId: string;
        targetStopId: number;
    }) => Promise<DeliveryHandoffManifestFetchResult>;
    isOnline: () => boolean;
    now?: () => Date;
};

const idleState: DeliveryHandoffControllerState = {
    handoff: null,
    status: 'idle',
    error: null,
    feedback: [],
};

function sameTarget(
    first: DeliveryHandoffTarget | null,
    second: DeliveryHandoffTarget | null,
) {
    return (
        first?.targetStopId === second?.targetStopId &&
        first?.retryAttempt === second?.retryAttempt
    );
}

function traceItems(
    deliveries: readonly DeliveryStopDeliverySummary[],
): DeliveryHandoffTraceItem[] {
    return deliveries.flatMap((delivery) =>
        delivery.stopId === null
            ? []
            : [
                  {
                      stopId: delivery.stopId,
                      tracePath: delivery.harvest.tracePath,
                  },
              ],
    );
}

export function deliveryHandoffDeliveriesFingerprint(
    deliveries: readonly DeliveryStopDeliverySummary[],
) {
    const items = deliveries
        .map((delivery) => [
            delivery.stopId,
            delivery.requestId,
            delivery.harvest.tracePath
                ? normalizeHarvestTraceScanValue(delivery.harvest.tracePath)
                : null,
        ])
        .sort((first, second) => {
            const firstValue = JSON.stringify(first);
            const secondValue = JSON.stringify(second);
            if (firstValue === secondValue) return 0;
            return firstValue < secondValue ? -1 : 1;
        });
    return JSON.stringify(items);
}

export function createSyntheticDeliveryHandoffManifest({
    runId,
    target,
    deliveries,
}: {
    runId: string;
    target: DeliveryHandoffTarget;
    deliveries: readonly DeliveryStopDeliverySummary[];
}): DeliveryHandoffManifest {
    const itemsByStopId = new Map<number, DeliveryRunHandoffItemSnapshot>();
    for (const delivery of deliveries) {
        if (delivery.stopId === null || itemsByStopId.has(delivery.stopId)) {
            continue;
        }
        const qrAvailable = Boolean(
            delivery.harvest.tracePath &&
                normalizeHarvestTraceScanValue(delivery.harvest.tracePath),
        );
        itemsByStopId.set(delivery.stopId, {
            stopId: delivery.stopId,
            deliveryRequestId: delivery.requestId,
            retryAttempt: target.retryAttempt,
            traceLinkId: null,
            qrAvailable,
            state: qrAvailable ? 'unverified' : 'no-label',
            reason: null,
            verifiedAt: null,
        });
    }
    const items = Array.from(itemsByStopId.values());
    return {
        runId,
        targetStopId: target.targetStopId,
        version: 1,
        retryAttempt: target.retryAttempt,
        items,
        expectedCount: items.length,
        scannedCount: 0,
        unverifiedCount: items.filter((item) => item.state === 'unverified')
            .length,
        noLabelCount: items.filter((item) => item.state === 'no-label').length,
        missingCount: 0,
        skippedCount: 0,
    };
}

function affectedItemStopIds(
    entry: DeliveryActionQueueEntry,
    currentTraceItems: readonly DeliveryHandoffTraceItem[],
) {
    if (!isDeliveryHandoffCommand(entry.command)) return [];
    if (entry.acknowledgement?.kind === 'handoff') {
        return entry.acknowledgement.result.affectedStopIds;
    }
    if (entry.command.kind === 'verification-mark') {
        return [entry.command.itemStopId];
    }
    const normalized = normalizeHarvestTraceScanValue(entry.command.tracePath);
    return normalized
        ? currentTraceItems.flatMap((item) =>
              item.tracePath &&
              normalizeHarvestTraceScanValue(item.tracePath) === normalized
                  ? [item.stopId]
                  : [],
          )
        : [];
}

function itemSyncState(
    itemStopId: number,
    entries: readonly DeliveryActionQueueEntry[],
    currentTraceItems: readonly DeliveryHandoffTraceItem[],
): DeliveryHandoffItemSyncState {
    const latest = entries
        .filter((entry) =>
            affectedItemStopIds(entry, currentTraceItems).includes(itemStopId),
        )
        .at(-1);
    switch (latest?.state) {
        case 'queued':
            return 'queued';
        case 'sending':
            return 'sending';
        case 'failed':
        case 'conflicted':
            return 'failed';
        default:
            return 'persisted';
    }
}

function feedbackMessage(
    entry: DeliveryActionQueueEntry,
): DeliveryHandoffFeedback | null {
    if (!isDeliveryHandoffCommand(entry.command)) return null;
    if (entry.state === 'failed') {
        return {
            operationId: entry.command.operationId,
            kind: 'sync-failed',
            message:
                'Provjera je spremljena na uređaju i ponovno će se poslati nakon povratka veze.',
        };
    }
    if (entry.state === 'conflicted') {
        return {
            operationId: entry.command.operationId,
            kind: 'conflict',
            message:
                'Provjeru nije moguće primijeniti na trenutačni posjet. Dostava i dalje nije blokirana.',
        };
    }
    if (entry.acknowledgement?.kind !== 'handoff') return null;
    switch (entry.acknowledgement.result.outcome) {
        case 'stale':
            return {
                operationId: entry.command.operationId,
                kind: 'stale',
                message:
                    'Noviji zapis provjere već postoji pa ova promjena nije prepisala stanje.',
            };
        case 'invalid':
            return {
                operationId: entry.command.operationId,
                kind: 'invalid',
                message: 'QR kod nije povezan s poznatim tragom uroda.',
            };
        case 'wrong-stop':
            return {
                operationId: entry.command.operationId,
                kind: 'wrong-stop',
                message: 'QR kod pripada drugoj stanici na ruti.',
            };
        case 'item-not-found':
            return {
                operationId: entry.command.operationId,
                kind: 'item-not-found',
                message:
                    'Urod više nije u trenutačnom manifestu. Osvježi popis i nastavi dostavu.',
            };
        case 'applied':
        case 'already-applied':
            return null;
    }
}

function feedbackForEntries(entries: readonly DeliveryActionQueueEntry[]) {
    return entries.flatMap((entry) => {
        const feedback = feedbackMessage(entry);
        return feedback ? [feedback] : [];
    });
}

function acknowledgementFeedbackForEntries(
    entries: readonly DeliveryActionQueueEntry[],
) {
    return feedbackForEntries(
        entries.filter((entry) => entry.acknowledgement?.kind === 'handoff'),
    );
}

function mergeFeedback(
    first: readonly DeliveryHandoffFeedback[],
    second: readonly DeliveryHandoffFeedback[],
) {
    const byOperationId = new Map<string, DeliveryHandoffFeedback>();
    for (const item of [...first, ...second]) {
        byOperationId.set(item.operationId, item);
    }
    return Array.from(byOperationId.values());
}

function verifiedTracePaths(
    handoff: DeliveryHandoffManifestView | null,
    deliveries: readonly DeliveryStopDeliverySummary[],
) {
    const scannedStopIds = new Set(
        handoff?.items.flatMap((item) =>
            item.state === 'scanned' ? [item.stopId] : [],
        ) ?? [],
    );
    return deliveries.flatMap((delivery) =>
        delivery.stopId !== null &&
        scannedStopIds.has(delivery.stopId) &&
        delivery.harvest.tracePath
            ? [delivery.harvest.tracePath]
            : [],
    );
}

function actionFailureMessage() {
    return 'Promjenu nije moguće sigurno spremiti. Pokušaj ponovno ili potvrdi dostavu bez QR provjere.';
}

export class DeliveryHandoffSyncController {
    private target: DeliveryHandoffTarget | null = null;
    private deliveries: readonly DeliveryStopDeliverySummary[] = [];
    private deliveriesFingerprint = '';
    private queueSnapshot: DeliveryActionQueueSnapshot;
    private manifest: DeliveryHandoffManifest | null = null;
    private state = idleState;
    private readonly listeners = new Set<() => void>();
    private generation = 0;
    private loading = false;
    private refreshing = false;
    private error: string | null = null;
    private refreshTask: {
        generation: number;
        promise: Promise<boolean>;
    } | null = null;
    private refreshRequested = false;
    private lastAcknowledgementSignature = '';
    private retainedFeedback: readonly DeliveryHandoffFeedback[] = [];
    private pruneTask: Promise<void> | null = null;
    private readonly now: () => Date;

    constructor(private readonly options: DeliveryHandoffControllerOptions) {
        this.queueSnapshot = options.actions.getSnapshot();
        this.now = options.now ?? (() => new Date());
    }

    getSnapshot = () => this.state;
    getServerSnapshot = () => idleState;

    subscribe = (listener: () => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };

    matchesTarget(target: DeliveryHandoffTarget) {
        return sameTarget(this.target, target);
    }

    dispose() {
        this.generation += 1;
        this.refreshRequested = false;
        this.listeners.clear();
    }

    async setContext({
        target,
        deliveries,
        queueSnapshot,
    }: {
        target: DeliveryHandoffTarget | null;
        deliveries: readonly DeliveryStopDeliverySummary[];
        queueSnapshot: DeliveryActionQueueSnapshot;
    }) {
        const changed = !sameTarget(this.target, target);
        const nextDeliveriesFingerprint =
            deliveryHandoffDeliveriesFingerprint(deliveries);
        const deliveriesChanged =
            this.deliveriesFingerprint !== nextDeliveriesFingerprint;
        this.target = target ? { ...target } : null;
        this.deliveries = deliveries;
        this.deliveriesFingerprint = nextDeliveriesFingerprint;
        this.queueSnapshot = queueSnapshot;
        if (!changed) {
            this.publish();
            if (deliveriesChanged && target && this.options.isOnline()) {
                await this.refresh();
            } else {
                this.refreshAfterNewAcknowledgement();
            }
            return;
        }

        this.generation += 1;
        const generation = this.generation;
        this.loading = Boolean(target);
        this.refreshing = false;
        this.error = null;
        this.refreshRequested = false;
        this.lastAcknowledgementSignature = '';
        this.retainedFeedback = [];
        if (!target) {
            this.manifest = null;
            this.state = idleState;
            this.publishListeners();
            return;
        }
        this.manifest = createSyntheticDeliveryHandoffManifest({
            runId: this.options.runId,
            target,
            deliveries,
        });
        this.publish();
        await this.activateTarget(generation, target);
    }

    private async activateTarget(
        generation: number,
        target: DeliveryHandoffTarget,
    ) {
        this.pruneTask ??=
            this.options.cache.clearOtherRuns?.({
                userId: this.options.userId,
                activeRunId: this.options.runId,
            }) ?? Promise.resolve();
        await this.pruneTask.catch(() => undefined);
        let cached = null;
        try {
            cached = await this.options.cache.load({
                userId: this.options.userId,
                runId: this.options.runId,
                targetStopId: target.targetStopId,
                expectedRetryAttempt: target.retryAttempt,
            });
        } catch {
            this.error =
                'Spremljeni manifest nije moguće pročitati. Pokušat ćemo ga ponovno preuzeti.';
        }
        if (!this.isCurrent(generation, target)) return;
        if (cached) {
            this.manifest = cached.manifest;
            this.loading = false;
            this.publish();
        }
        if (!this.options.isOnline()) {
            this.loading = false;
            this.publish();
            return;
        }
        await this.refresh();
    }

    updateQueueSnapshot(queueSnapshot: DeliveryActionQueueSnapshot) {
        this.queueSnapshot = queueSnapshot;
        this.publish();
        this.refreshAfterNewAcknowledgement();
    }

    private isCurrent(generation: number, target: DeliveryHandoffTarget) {
        return (
            generation === this.generation && sameTarget(this.target, target)
        );
    }

    async refresh() {
        const target = this.target;
        if (!target || !this.options.isOnline()) {
            this.loading = false;
            this.publish();
            return false;
        }
        if (this.refreshTask?.generation === this.generation) {
            this.refreshRequested = true;
            return await this.refreshTask.promise;
        }
        const generation = this.generation;
        const promise = this.refreshCurrent(generation, { ...target }).finally(
            () => {
                if (this.refreshTask?.promise === promise) {
                    const repeat =
                        this.refreshRequested &&
                        this.isCurrent(generation, target) &&
                        this.options.isOnline();
                    this.refreshTask = null;
                    this.refreshRequested = false;
                    if (repeat) void this.refresh();
                }
            },
        );
        this.refreshTask = { generation, promise };
        return await promise;
    }

    private async refreshCurrent(
        generation: number,
        target: DeliveryHandoffTarget,
    ) {
        this.refreshing = true;
        this.error = null;
        this.publish();
        try {
            this.queueSnapshot = await this.options.actions.syncNow();
        } catch {
            this.queueSnapshot = this.options.actions.getSnapshot();
        }
        if (!this.isCurrent(generation, target)) return false;
        this.publish();
        const reconciliationEntries = deliveryHandoffQueueEntries(
            this.queueSnapshot,
            this.manifest ??
                createSyntheticDeliveryHandoffManifest({
                    runId: this.options.runId,
                    target,
                    deliveries: this.deliveries,
                }),
        ).filter(
            (entry) =>
                entry.state === 'synced' &&
                entry.acknowledgement?.kind === 'handoff',
        );
        const reconciliationOperationIds = reconciliationEntries.map(
            (entry) => entry.command.operationId,
        );
        const reconciliationFeedback = acknowledgementFeedbackForEntries(
            reconciliationEntries,
        );
        let result: DeliveryHandoffManifestFetchResult;
        try {
            result = await this.options.fetchManifest({
                runId: this.options.runId,
                targetStopId: target.targetStopId,
            });
        } catch {
            result = { status: 'retryable-failure', code: 'offline' };
        }
        if (!this.isCurrent(generation, target)) return false;
        if (result.status !== 'loaded') {
            this.loading = false;
            this.refreshing = false;
            this.error =
                result.code === 'offline'
                    ? 'Nema internetske veze. Provjere ostaju spremljene na uređaju.'
                    : 'Manifest predaje trenutačno nije moguće osvježiti. Dostava nije blokirana.';
            this.publish();
            return false;
        }
        if (
            result.manifest.runId !== this.options.runId ||
            result.manifest.targetStopId !== target.targetStopId ||
            result.manifest.retryAttempt !== target.retryAttempt
        ) {
            this.loading = false;
            this.refreshing = false;
            this.error =
                'Posjet stanici promijenio se. Osvježi rutu prije nove provjere.';
            this.publish();
            return false;
        }

        this.manifest = result.manifest;
        try {
            await this.options.cache.save(
                createDeliveryHandoffManifestCacheRecord({
                    userId: this.options.userId,
                    manifest: result.manifest,
                    now: this.now(),
                }),
            );
            if (
                this.options.cache.durableCleanupRequired &&
                this.options.cache.durability !== 'durable'
            ) {
                throw new Error(
                    'Durable delivery handoff persistence could not be confirmed',
                );
            }
        } catch {
            this.loading = false;
            this.refreshing = false;
            this.error =
                'Manifest je učitan, ali ga nije moguće sigurno spremiti na uređaj. Provjera ostaje neblokirajuća.';
            this.publish();
            return false;
        }
        if (!this.isCurrent(generation, target)) return false;
        this.loading = false;
        this.retainedFeedback = mergeFeedback(
            this.retainedFeedback,
            reconciliationFeedback,
        );
        this.publish();
        try {
            await this.options.actions.completeHandoffReconciliation(
                target.targetStopId,
                target.retryAttempt,
                reconciliationOperationIds,
            );
        } catch {
            this.error =
                'Provjere su potvrđene, ali lokalni QR podaci još nisu očišćeni.';
        }
        if (!this.isCurrent(generation, target)) return false;
        this.queueSnapshot = this.options.actions.getSnapshot();
        const reconciledOperationIdSet = new Set(reconciliationOperationIds);
        const acknowledgementRacedManifestFetch = deliveryHandoffQueueEntries(
            this.queueSnapshot,
            result.manifest,
        ).some(
            (entry) =>
                entry.state === 'synced' &&
                entry.acknowledgement?.kind === 'handoff' &&
                !reconciledOperationIdSet.has(entry.command.operationId),
        );
        if (acknowledgementRacedManifestFetch) {
            this.refreshRequested = true;
        }
        this.refreshing = false;
        this.lastAcknowledgementSignature = '';
        this.publish();
        return this.error === null;
    }

    connectionChanged() {
        if (!this.options.isOnline()) {
            this.refreshing = false;
            this.publish();
            return;
        }
        void this.refresh();
    }

    async scan(value: string): Promise<DeliveryHandoffScanResult> {
        const target = this.target;
        if (!target) {
            return {
                status: 'scan-failed',
                message: 'Trenutačna stanica predaje nije dostupna.',
            };
        }
        const generation = this.generation;
        const result = verifyDeliveryStopHarvestTrace({
            deliveries: [...this.deliveries],
            verifiedTracePaths: verifiedTracePaths(
                this.state.handoff,
                this.deliveries,
            ),
            scanValue: value,
        });
        if (
            result.status === 'verification-invalid' ||
            result.status === 'already-verified'
        ) {
            return result;
        }
        try {
            await this.options.actions.enqueueVerificationScan(
                target.targetStopId,
                result.tracePath,
                target.retryAttempt,
            );
            if (!this.isCurrent(generation, target)) {
                return {
                    status: 'scan-failed',
                    message:
                        'Stanica se promijenila tijekom spremanja provjere. Provjeri trenutačnu dostavu.',
                };
            }
            this.queueSnapshot = this.options.actions.getSnapshot();
            this.publish();
        } catch {
            if (result.status !== 'verified') return result;
            return { status: 'scan-failed', message: actionFailureMessage() };
        }
        return result;
    }

    async markItem(
        input: DeliveryHandoffMarkInput,
    ): Promise<DriverCommandResult> {
        const target = this.target;
        if (
            !target ||
            !this.state.handoff?.items.some(
                (item) => item.stopId === input.itemStopId,
            )
        ) {
            return {
                status: 'failed',
                message: 'Urod više nije u trenutačnom manifestu.',
            };
        }
        const generation = this.generation;
        try {
            await this.options.actions.enqueueVerificationMark({
                stopId: target.targetStopId,
                expectedRetryAttempt: target.retryAttempt,
                itemStopId: input.itemStopId,
                outcome: input.outcome,
                reason: input.reason,
            });
            if (!this.isCurrent(generation, target)) {
                return {
                    status: 'failed',
                    message:
                        'Stanica se promijenila tijekom spremanja provjere.',
                };
            }
            this.queueSnapshot = this.options.actions.getSnapshot();
            this.publish();
            return { status: 'saved' };
        } catch {
            return { status: 'failed', message: actionFailureMessage() };
        }
    }

    async markRemainingReviewed(): Promise<DriverCommandResult> {
        const unresolved =
            this.state.handoff?.items.filter(
                (item) => item.state === 'unverified',
            ) ?? [];
        for (const item of unresolved) {
            const result = await this.markItem({
                itemStopId: item.stopId,
                outcome: 'skipped',
                reason: 'manual-verification',
            });
            if (result.status === 'failed') return result;
        }
        return { status: 'saved' };
    }

    private refreshAfterNewAcknowledgement() {
        if (!this.target || !this.options.isOnline()) return;
        const signature = deliveryHandoffQueueEntries(
            this.queueSnapshot,
            this.manifest ??
                createSyntheticDeliveryHandoffManifest({
                    runId: this.options.runId,
                    target: this.target,
                    deliveries: this.deliveries,
                }),
        )
            .flatMap((entry) =>
                entry.acknowledgement?.kind === 'handoff'
                    ? [
                          `${entry.command.operationId}:${entry.acknowledgement.result.outcome}`,
                      ]
                    : [],
            )
            .join('|');
        if (!signature || signature === this.lastAcknowledgementSignature) {
            return;
        }
        this.lastAcknowledgementSignature = signature;
        void this.refresh();
    }

    private publish() {
        if (!this.target || !this.manifest) {
            this.state = idleState;
            this.publishListeners();
            return;
        }
        const currentTraceItems = traceItems(this.deliveries);
        const projection = projectDeliveryHandoffManifest({
            manifest: this.manifest,
            snapshot: this.queueSnapshot,
            traceItems: currentTraceItems,
        });
        const entries = deliveryHandoffQueueEntries(
            this.queueSnapshot,
            this.manifest,
        );
        const feedback = mergeFeedback(
            this.retainedFeedback,
            feedbackForEntries(entries),
        );
        const failed =
            projection.failedOperationIds.length > 0 ||
            projection.conflictedOperationIds.length > 0;
        const status: Exclude<DeliveryHandoffSyncStatus, 'idle'> = this.loading
            ? this.options.isOnline()
                ? 'loading'
                : 'offline'
            : !this.options.isOnline()
              ? 'offline'
              : this.error || failed
                ? 'failed'
                : this.refreshing || projection.pendingOperationIds.length > 0
                  ? 'syncing'
                  : 'ready';
        const error =
            this.error ??
            (failed
                ? 'Neke provjere još nisu potvrđene. Dostava nije blokirana.'
                : null);
        this.state = {
            status,
            error,
            feedback,
            handoff: {
                ...projection.manifest,
                items: projection.manifest.items.map((item) => ({
                    ...item,
                    syncState: itemSyncState(
                        item.stopId,
                        entries,
                        currentTraceItems,
                    ),
                })),
                syncState: status,
                pendingCount: projection.pendingOperationIds.length,
                error,
            },
        };
        this.publishListeners();
    }

    private publishListeners() {
        for (const listener of this.listeners) listener();
    }
}
