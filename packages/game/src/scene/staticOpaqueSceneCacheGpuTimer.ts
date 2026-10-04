import type { StaticOpaqueSceneCacheBenefitSampleKind } from './staticOpaqueSceneCacheBenefit';

const maximumPendingQueries = 4;
const queryTimeoutMs = 2_000;
const disjointQuarantineMs = 2_000;

type DisjointTimerQueryWebGl2Extension = {
    GPU_DISJOINT_EXT: number;
    TIME_ELAPSED_EXT: number;
};

type TimerQueryContext = {
    beginQuery(target: number, query: WebGLQuery): void;
    createQuery(): WebGLQuery | null;
    readonly CURRENT_QUERY: number;
    deleteQuery(query: WebGLQuery | null): void;
    endQuery(target: number): void;
    getExtension(name: string): unknown;
    getParameter(parameter: number): unknown;
    getQuery(target: number, parameter: number): WebGLQuery | null;
    getQueryParameter(query: WebGLQuery, parameter: number): unknown;
    readonly QUERY_RESULT: number;
    readonly QUERY_RESULT_AVAILABLE: number;
};

type PendingQuery = {
    kind: StaticOpaqueSceneCacheBenefitSampleKind;
    query: WebGLQuery;
    startedAtMs: number;
    windowId: number;
};

export type StaticOpaqueSceneCacheGpuSample = {
    elapsedMs: number;
    kind: StaticOpaqueSceneCacheBenefitSampleKind;
    startedAtMs: number;
    windowId: number;
};

function isTimerExtension(
    value: unknown,
): value is DisjointTimerQueryWebGl2Extension {
    return (
        typeof value === 'object' &&
        value !== null &&
        typeof Reflect.get(value, 'GPU_DISJOINT_EXT') === 'number' &&
        typeof Reflect.get(value, 'TIME_ELAPSED_EXT') === 'number'
    );
}

function hasExternalGpuTimer() {
    return (
        typeof window !== 'undefined' &&
        Reflect.get(window, '__gameProfileGpuTimer') !== undefined
    );
}

/**
 * Times individual cache frames with EXT_disjoint_timer_query_webgl2.
 *
 * WebGL allows one active TIME_ELAPSED query, so the timer yields whenever
 * another owner (adaptive High, the profiler) already has one open and never
 * runs while the profiler's external timer is installed.
 */
export class StaticOpaqueSceneCacheGpuTimer {
    private active: PendingQuery | null = null;
    private context: TimerQueryContext | null = null;
    private contextLost = false;
    private extension: DisjointTimerQueryWebGl2Extension | null = null;
    private pending: PendingQuery[] = [];
    private quarantinedUntilMs = 0;
    supported: boolean | null = null;
    evidenceEpoch = 0;

    attach(context: TimerQueryContext | null) {
        if (this.context === context) {
            return;
        }
        this.dispose();
        this.context = context;
        this.contextLost = false;
        const extension = context?.getExtension(
            'EXT_disjoint_timer_query_webgl2',
        );
        this.extension = isTimerExtension(extension) ? extension : null;
        this.supported = this.extension !== null;
        this.observeProfile({ type: 'supported', supported: this.supported });
    }

    /** True when `begin` would open a query right now. */
    isAvailable(nowMs: number) {
        const { context, extension } = this;
        return Boolean(
            context &&
                extension &&
                this.supported === true &&
                !this.contextLost &&
                !hasExternalGpuTimer() &&
                nowMs >= this.quarantinedUntilMs &&
                !this.active &&
                this.pending.length < maximumPendingQueries &&
                context.getQuery(
                    extension.TIME_ELAPSED_EXT,
                    context.CURRENT_QUERY,
                ) === null,
        );
    }

    begin(
        kind: StaticOpaqueSceneCacheBenefitSampleKind,
        nowMs: number,
        windowId = 0,
    ) {
        const { context, extension } = this;
        if (!context || !extension || !this.isAvailable(nowMs)) {
            return false;
        }

        const query = context.createQuery();
        if (!query) {
            this.supported = false;
            return false;
        }
        context.beginQuery(extension.TIME_ELAPSED_EXT, query);
        this.active = { kind, query, startedAtMs: nowMs, windowId };
        this.observeProfile({ type: 'begin', startedAtMs: nowMs });
        return true;
    }

    end() {
        const { active, context, extension } = this;
        this.active = null;
        if (!active || !context || !extension || this.contextLost) {
            return;
        }
        const currentQuery = context.getQuery(
            extension.TIME_ELAPSED_EXT,
            context.CURRENT_QUERY,
        );
        if (currentQuery !== active.query) {
            context.deleteQuery(active.query);
            return;
        }
        context.endQuery(extension.TIME_ELAPSED_EXT);
        this.pending.push(active);
    }

    poll(nowMs: number): StaticOpaqueSceneCacheGpuSample[] {
        const { context, extension } = this;
        if (!context || !extension || this.contextLost) {
            return [];
        }
        if (context.getParameter(extension.GPU_DISJOINT_EXT)) {
            this.deletePending();
            if (nowMs >= this.quarantinedUntilMs) {
                this.evidenceEpoch += 1;
            }
            this.quarantinedUntilMs = nowMs + disjointQuarantineMs;
            this.observeProfile({ type: 'invalid', reason: 'disjoint' });
            return [];
        }

        const samples: StaticOpaqueSceneCacheGpuSample[] = [];
        const remaining: PendingQuery[] = [];
        for (const entry of this.pending) {
            if (
                context.getQueryParameter(
                    entry.query,
                    context.QUERY_RESULT_AVAILABLE,
                )
            ) {
                const elapsedNanoseconds = context.getQueryParameter(
                    entry.query,
                    context.QUERY_RESULT,
                );
                if (
                    typeof elapsedNanoseconds === 'number' &&
                    Number.isFinite(elapsedNanoseconds) &&
                    elapsedNanoseconds >= 0
                ) {
                    samples.push({
                        elapsedMs: elapsedNanoseconds / 1_000_000,
                        kind: entry.kind,
                        startedAtMs: entry.startedAtMs,
                        windowId: entry.windowId,
                    });
                    this.observeProfile({
                        type: 'sample',
                        sample: samples.at(-1),
                    });
                } else {
                    this.supported = false;
                    this.evidenceEpoch += 1;
                    this.observeProfile({
                        type: 'invalid',
                        reason: 'invalid-result',
                    });
                }
                context.deleteQuery(entry.query);
                continue;
            }
            if (nowMs - entry.startedAtMs >= queryTimeoutMs) {
                context.deleteQuery(entry.query);
                this.supported = false;
                this.evidenceEpoch += 1;
                this.observeProfile({ type: 'invalid', reason: 'timeout' });
                continue;
            }
            remaining.push(entry);
        }
        this.pending = remaining;
        return samples;
    }

    /** Supplemental profiler observes these queries without owning a WebGL query. */
    isProfileObserved() {
        return (
            typeof window !== 'undefined' &&
            typeof Reflect.get(window, '__gameProfileCacheGpuObserver') ===
                'function'
        );
    }

    private observeProfile(event: unknown) {
        if (typeof window === 'undefined') {
            return;
        }
        const observer = Reflect.get(window, '__gameProfileCacheGpuObserver');
        if (typeof observer === 'function') {
            try {
                Reflect.apply(observer, window, [event]);
            } catch {
                // Diagnostic observers must not interrupt scene rendering.
            }
        }
    }

    markContextLost() {
        this.evidenceEpoch += 1;
        this.observeProfile({ type: 'invalid', reason: 'context-lost' });
        this.contextLost = true;
        this.active = null;
        this.pending = [];
    }

    dispose() {
        const { active, context, extension } = this;
        if (context && extension && !this.contextLost && active) {
            if (
                context.getQuery(
                    extension.TIME_ELAPSED_EXT,
                    context.CURRENT_QUERY,
                ) === active.query
            ) {
                context.endQuery(extension.TIME_ELAPSED_EXT);
            }
            context.deleteQuery(active.query);
        }
        this.active = null;
        this.deletePending();
        this.context = null;
        this.extension = null;
        this.supported = null;
    }

    private deletePending() {
        if (this.context && !this.contextLost) {
            for (const entry of this.pending) {
                this.context.deleteQuery(entry.query);
            }
        }
        this.pending = [];
    }
}
