export type GameResourceKind =
    | 'geometry'
    | 'gltf'
    | 'program'
    | 'render-target'
    | 'texture'
    | 'worker-client';

export type GameResourceSuspendReason = 'context-lost' | 'hidden';

export type GameResourceCacheOptions<TimerHandle> = {
    /** Bytes of unreferenced, unpinned resources kept warm for return visits. */
    budgetBytes: number;
    /** Minimum time a resource stays resident after its last release. */
    graceMs: number;
    now: () => number;
    setTimeout: (callback: () => void, delayMs: number) => TimerHandle;
    clearTimeout: (handle: TimerHandle) => void;
    onChange?: (snapshot: GameResourceCacheSnapshot) => void;
};

type GameResourceEntry = {
    readonly key: string;
    kind: GameResourceKind;
    value: unknown;
    bytes: number;
    refs: number;
    /** Last acquire or release; drives LRU order among idle entries. */
    lastUsedAt: number;
    releasedAt: number | null;
    dispose: (() => void) | null;
};

export type GameResourceKindSnapshot = {
    count: number;
    bytes: number;
};

export type GameResourceCacheSnapshot = {
    entries: number;
    referenced: number;
    pinned: number;
    idle: number;
    bytes: number;
    referencedBytes: number;
    idleBytes: number;
    peakBytes: number;
    budgetBytes: number;
    evictions: number;
    evictedBytes: number;
    suspended: GameResourceSuspendReason[];
    byKind: Partial<Record<GameResourceKind, GameResourceKindSnapshot>>;
};

/**
 * Refcounted resource lifetimes shared by every game root. Referenced and
 * pinned resources are never evicted. Unreferenced resources stay resident
 * for a grace period and then leave in least-recently-used order whenever the
 * idle bytes exceed the budget, so repeated garden switching plateaus at
 * `referenced + budget` instead of growing with every garden visited.
 */
export class GameResourceCache<TimerHandle = unknown> {
    private readonly entries = new Map<string, GameResourceEntry>();
    private readonly pins = new Map<string, ReadonlySet<string>>();
    private readonly suspended = new Set<GameResourceSuspendReason>();
    private sweepHandle: TimerHandle | null = null;
    private sweepAt = Number.POSITIVE_INFINITY;
    private evictions = 0;
    private evictedBytes = 0;
    private peakBytes = 0;

    constructor(
        private readonly options: GameResourceCacheOptions<TimerHandle>,
    ) {}

    /**
     * Registers (or replaces) the loaded value behind a key. Replacing a value
     * keeps the refcount: consumers that reloaded after an eviction share it.
     */
    track(
        key: string,
        kind: GameResourceKind,
        value: unknown,
        describe: () => { bytes: number; dispose: () => void },
    ) {
        const existing = this.entries.get(key);
        if (existing && existing.value === value && existing.dispose) {
            return;
        }
        const { bytes, dispose } = describe();
        const now = this.options.now();
        if (existing) {
            existing.kind = kind;
            existing.value = value;
            existing.bytes = bytes;
            existing.dispose = dispose;
        } else {
            this.entries.set(key, {
                key,
                kind,
                value,
                bytes,
                refs: 0,
                lastUsedAt: now,
                releasedAt: now,
                dispose,
            });
        }
        this.changed();
    }

    has(key: string) {
        return Boolean(this.entries.get(key)?.dispose);
    }

    /** Holds a resource for a mounted consumer; the release is idempotent. */
    acquire(key: string, kind: GameResourceKind = 'gltf') {
        let entry = this.entries.get(key);
        if (!entry) {
            entry = {
                key,
                kind,
                value: undefined,
                bytes: 0,
                refs: 0,
                lastUsedAt: this.options.now(),
                releasedAt: null,
                dispose: null,
            };
            this.entries.set(key, entry);
        }
        const held = entry;
        held.refs++;
        held.lastUsedAt = this.options.now();
        held.releasedAt = null;
        this.changed();

        let released = false;
        return () => {
            if (released) return;
            released = true;
            held.refs = Math.max(0, held.refs - 1);
            const now = this.options.now();
            held.lastUsedAt = now;
            if (held.refs === 0) {
                held.releasedAt = now;
                // Nothing loaded yet: a placeholder has nothing to keep warm.
                if (!held.dispose && this.entries.get(held.key) === held) {
                    this.entries.delete(held.key);
                }
            }
            this.changed();
        };
    }

    /** Replaces one owner's pinned set (for example current + incoming scene). */
    setPins(owner: string, keys: Iterable<string>) {
        const next = new Set(keys);
        if (next.size === 0) this.pins.delete(owner);
        else this.pins.set(owner, next);
        this.changed();
    }

    setSuspended(reason: GameResourceSuspendReason, suspended: boolean) {
        if (suspended === this.suspended.has(reason)) return;
        if (suspended) this.suspended.add(reason);
        else this.suspended.delete(reason);
        this.changed();
    }

    isPinned(key: string) {
        for (const keys of this.pins.values()) {
            if (keys.has(key)) return true;
        }
        return false;
    }

    /** Evicts every eligible idle resource that exceeds the budget. */
    sweep() {
        this.clearScheduledSweep();
        if (this.suspended.size > 0) {
            this.publish();
            return;
        }
        const now = this.options.now();
        const idle = this.idleEntries();
        let idleBytes = idle.reduce((total, entry) => total + entry.bytes, 0);
        const eligible = idle
            .filter(
                (entry) =>
                    entry.releasedAt !== null &&
                    now - entry.releasedAt >= this.options.graceMs,
            )
            .sort((left, right) => left.lastUsedAt - right.lastUsedAt);
        for (const entry of eligible) {
            if (idleBytes <= this.options.budgetBytes) break;
            idleBytes -= entry.bytes;
            this.evict(entry);
        }
        this.scheduleSweep();
        this.publish();
    }

    /** Disposes every unreferenced resource immediately (tests, teardown). */
    evictIdle() {
        for (const entry of this.idleEntries()) this.evict(entry);
        this.publish();
    }

    getSnapshot(): GameResourceCacheSnapshot {
        let referenced = 0;
        let pinned = 0;
        let idle = 0;
        let bytes = 0;
        let referencedBytes = 0;
        let idleBytes = 0;
        const byKind: GameResourceCacheSnapshot['byKind'] = {};
        for (const entry of this.entries.values()) {
            bytes += entry.bytes;
            const kind = byKind[entry.kind] ?? { count: 0, bytes: 0 };
            kind.count++;
            kind.bytes += entry.bytes;
            byKind[entry.kind] = kind;
            if (entry.refs > 0) {
                referenced++;
                referencedBytes += entry.bytes;
            } else if (this.isPinned(entry.key)) {
                pinned++;
            } else {
                idle++;
                idleBytes += entry.bytes;
            }
        }
        return {
            entries: this.entries.size,
            referenced,
            pinned,
            idle,
            bytes,
            referencedBytes,
            idleBytes,
            peakBytes: this.peakBytes,
            budgetBytes: this.options.budgetBytes,
            evictions: this.evictions,
            evictedBytes: this.evictedBytes,
            suspended: [...this.suspended].sort(),
            byKind,
        };
    }

    dispose() {
        this.clearScheduledSweep();
        this.pins.clear();
        this.evictIdle();
    }

    private idleEntries() {
        return [...this.entries.values()].filter(
            (entry) =>
                entry.refs === 0 &&
                entry.dispose !== null &&
                !this.isPinned(entry.key),
        );
    }

    private evict(entry: GameResourceEntry) {
        if (this.entries.get(entry.key) !== entry) return;
        this.entries.delete(entry.key);
        this.evictions++;
        this.evictedBytes += entry.bytes;
        entry.dispose?.();
        entry.dispose = null;
        entry.value = undefined;
    }

    private changed() {
        this.scheduleSweep();
        this.publish();
    }

    private publish() {
        let bytes = 0;
        for (const entry of this.entries.values()) bytes += entry.bytes;
        this.peakBytes = Math.max(this.peakBytes, bytes);
        this.options.onChange?.(this.getSnapshot());
    }

    private clearScheduledSweep() {
        if (this.sweepHandle !== null) {
            this.options.clearTimeout(this.sweepHandle);
            this.sweepHandle = null;
        }
        this.sweepAt = Number.POSITIVE_INFINITY;
    }

    private scheduleSweep() {
        if (this.suspended.size > 0) {
            this.clearScheduledSweep();
            return;
        }
        const idle = this.idleEntries();
        const idleBytes = idle.reduce((total, entry) => total + entry.bytes, 0);
        if (idleBytes <= this.options.budgetBytes) {
            this.clearScheduledSweep();
            return;
        }
        let earliest = Number.POSITIVE_INFINITY;
        for (const entry of idle) {
            if (entry.releasedAt === null) continue;
            earliest = Math.min(
                earliest,
                entry.releasedAt + this.options.graceMs,
            );
        }
        if (!Number.isFinite(earliest)) {
            this.clearScheduledSweep();
            return;
        }
        const at = Math.max(earliest, this.options.now());
        if (this.sweepHandle !== null && this.sweepAt <= at) return;
        this.clearScheduledSweep();
        this.sweepAt = at;
        this.sweepHandle = this.options.setTimeout(
            () => {
                this.sweepHandle = null;
                this.sweepAt = Number.POSITIVE_INFINITY;
                this.sweep();
            },
            Math.max(0, at - this.options.now()),
        );
    }
}
