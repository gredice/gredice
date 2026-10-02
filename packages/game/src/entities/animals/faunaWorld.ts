import type { AnimalDebugEntry, AnimalPresenceEntry } from '../../useGameState';

/**
 * Seconds between batched debug snapshot publications. Matches the cadence
 * every species previously used for its own per-actor store writes.
 */
export const faunaDebugPublishIntervalSeconds = 0.5;

const presenceStride = 4;
const presenceX = 0;
const presenceY = 1;
const presenceZ = 2;
const presenceUpdatedAt = 3;
const initialPresenceCapacity = 16;
const defaultSpatialCellSize = 4;
const spatialCellKeyOffset = 32_768;
const spatialCellKeyStride = 65_536;

type FaunaPoint = { x: number; y: number; z: number };

export type FaunaPresenceInput = AnimalPresenceEntry;

export type FaunaPresenceQuery = {
    behavior?: string;
    /** Horizontal center for a spatial query; requires `radius`. */
    center?: FaunaPoint;
    maxAgeSeconds?: number;
    now?: number;
    /** Exact 3D distance limit around `center`. */
    radius?: number;
    species?: string;
};

export type FaunaWorldStats = {
    actorCount: number;
    /** Frames where an actor skipped pose work because it was not rendered. */
    actorPoseSkipCount: number;
    actorPoseUpdateCount: number;
    debugEntryCount: number;
    debugPublishCount: number;
    debugReportCount: number;
    debugSkippedPublishCount: number;
    presenceCapacity: number;
    presenceQueryCount: number;
    presenceReportCount: number;
    presenceSnapshotBuildCount: number;
    removedActorCount: number;
};

export type FaunaWorldOptions = {
    debugPublishIntervalSeconds?: number;
    /** Coalesced stats after membership changes and debug publications. */
    onStats?: (stats: FaunaWorldStats) => void;
    /** Receives one sorted snapshot per batch, only after semantic changes. */
    publishDebugEntries: (entries: AnimalDebugEntry[]) => void;
    /** Schedules trailing work and returns its cancel function. */
    schedule?: (callback: () => void, delayMs: number) => () => void;
    spatialCellSize?: number;
};

function spatialCellCoordinate(value: number, cellSize: number) {
    return Math.floor(value / cellSize);
}

function spatialCellKey(cellX: number, cellZ: number) {
    return (
        (cellX + spatialCellKeyOffset) * spatialCellKeyStride +
        (cellZ + spatialCellKeyOffset)
    );
}

function sameDebugPoint(
    left: AnimalDebugEntry['position'] | undefined,
    right: AnimalDebugEntry['position'] | undefined,
) {
    if (!left || !right) {
        return left === right;
    }

    return left.x === right.x && left.y === right.y && left.z === right.z;
}

function sameCell(
    left: { x: number; z: number } | undefined,
    right: { x: number; z: number } | undefined,
) {
    if (!left || !right) {
        return left === right;
    }

    return left.x === right.x && left.z === right.z;
}

function sameStringList(
    left: readonly string[] | undefined,
    right: readonly string[] | undefined,
) {
    if (left === right) {
        return true;
    }
    if (!left || !right || left.length !== right.length) {
        return false;
    }

    return left.every((value, index) => value === right[index]);
}

/**
 * Debug entries are equivalent when everything except the report timestamp
 * matches, so settled actors stop waking HUD subscribers.
 */
export function areAnimalDebugEntriesEquivalent(
    left: AnimalDebugEntry,
    right: AnimalDebugEntry,
) {
    if (
        left.id !== right.id ||
        left.species !== right.species ||
        left.label !== right.label ||
        left.phase !== right.phase ||
        left.behavior !== right.behavior ||
        left.activity !== right.activity ||
        left.targetId !== right.targetId ||
        !sameDebugPoint(left.position, right.position) ||
        !sameStringList(left.debugBehaviors, right.debugBehaviors)
    ) {
        return false;
    }

    const leftPath = left.pathfinding;
    const rightPath = right.pathfinding;
    if (!leftPath || !rightPath) {
        return leftPath === rightPath;
    }

    return (
        leftPath.blockedCellCount === rightPath.blockedCellCount &&
        leftPath.distance === rightPath.distance &&
        leftPath.status === rightPath.status &&
        leftPath.visitedCellCount === rightPath.visitedCellCount &&
        leftPath.waypointCount === rightPath.waypointCount &&
        sameDebugPoint(leftPath.nextWaypoint, rightPath.nextWaypoint) &&
        sameCell(leftPath.targetCell, rightPath.targetCell)
    );
}

function compareDebugEntries(left: AnimalDebugEntry, right: AnimalDebugEntry) {
    return (
        left.label.localeCompare(right.label) || left.id.localeCompare(right.id)
    );
}

/**
 * One fauna registry per game root. Actors report presence into packed,
 * slot-stable storage and read neighbors through a shared spatial grid.
 * Debug state is held here and published to the game store in one batched,
 * change-gated write instead of one store write per actor.
 */
export function createFaunaWorld({
    debugPublishIntervalSeconds = faunaDebugPublishIntervalSeconds,
    onStats,
    publishDebugEntries,
    schedule = (callback, delayMs) => {
        const handle = setTimeout(callback, delayMs);
        return () => clearTimeout(handle);
    },
    spatialCellSize = defaultSpatialCellSize,
}: FaunaWorldOptions) {
    let presenceCapacity = initialPresenceCapacity;
    let presenceTransforms = new Float64Array(
        presenceCapacity * presenceStride,
    );
    let slotIds: (string | undefined)[] = new Array(presenceCapacity);
    let slotSpecies: (string | undefined)[] = new Array(presenceCapacity);
    let slotBehaviors: (string | undefined)[] = new Array(presenceCapacity);
    let slotCellKeys = new Float64Array(presenceCapacity).fill(Number.NaN);
    const freeSlots: number[] = [];
    let nextSlot = 0;
    const slotById = new Map<string, number>();
    const slotsBySpecies = new Map<string, Set<number>>();
    const slotsByCell = new Map<number, Set<number>>();
    const speciesSnapshots = new Map<
        string,
        { entries: AnimalPresenceEntry[]; version: number }
    >();
    const speciesVersions = new Map<string, number>();

    const debugEntries = new Map<string, AnimalDebugEntry>();
    let debugEntriesSnapshot: AnimalDebugEntry[] = [];
    let debugEntriesSnapshotVersion = -1;
    let debugVersion = 0;
    /** Bumps on every report, including timestamp-only refreshes. */
    let debugLiveVersion = 0;
    let publishedDebugVersion = 0;
    let lastDebugPublishAt = Number.NEGATIVE_INFINITY;
    let cancelTrailingPublish: (() => void) | null = null;
    let cancelStatsPublish: (() => void) | null = null;
    let disposed = false;

    const stats: FaunaWorldStats = {
        actorCount: 0,
        actorPoseSkipCount: 0,
        actorPoseUpdateCount: 0,
        debugEntryCount: 0,
        debugPublishCount: 0,
        debugReportCount: 0,
        debugSkippedPublishCount: 0,
        presenceCapacity,
        presenceQueryCount: 0,
        presenceReportCount: 0,
        presenceSnapshotBuildCount: 0,
        removedActorCount: 0,
    };

    function requestStatsPublish() {
        if (!onStats || cancelStatsPublish !== null || disposed) {
            return;
        }

        cancelStatsPublish = schedule(() => {
            cancelStatsPublish = null;
            if (!disposed) {
                onStats({ ...stats });
            }
        }, 0);
    }

    function bumpSpeciesVersion(species: string) {
        speciesVersions.set(species, (speciesVersions.get(species) ?? 0) + 1);
    }

    function growPresenceStorage() {
        const nextCapacity = presenceCapacity * 2;
        const nextTransforms = new Float64Array(nextCapacity * presenceStride);
        nextTransforms.set(presenceTransforms);
        presenceTransforms = nextTransforms;
        const nextCellKeys = new Float64Array(nextCapacity).fill(Number.NaN);
        nextCellKeys.set(slotCellKeys);
        slotCellKeys = nextCellKeys;
        slotIds = slotIds.concat(new Array(nextCapacity - presenceCapacity));
        slotSpecies = slotSpecies.concat(
            new Array(nextCapacity - presenceCapacity),
        );
        slotBehaviors = slotBehaviors.concat(
            new Array(nextCapacity - presenceCapacity),
        );
        presenceCapacity = nextCapacity;
        stats.presenceCapacity = presenceCapacity;
    }

    function allocateSlot() {
        const reused = freeSlots.pop();
        if (reused !== undefined) {
            return reused;
        }
        if (nextSlot >= presenceCapacity) {
            growPresenceStorage();
        }
        const slot = nextSlot;
        nextSlot += 1;
        return slot;
    }

    function setSlotCell(slot: number, cellKey: number) {
        const previous = slotCellKeys[slot];
        if (previous === cellKey) {
            return;
        }
        if (!Number.isNaN(previous)) {
            const previousCell = slotsByCell.get(previous);
            previousCell?.delete(slot);
            if (previousCell && previousCell.size === 0) {
                slotsByCell.delete(previous);
            }
        }
        slotCellKeys[slot] = cellKey;
        let cell = slotsByCell.get(cellKey);
        if (!cell) {
            cell = new Set();
            slotsByCell.set(cellKey, cell);
        }
        cell.add(slot);
    }

    function setSlotSpecies(slot: number, species: string) {
        const previous = slotSpecies[slot];
        if (previous === species) {
            return;
        }
        if (previous !== undefined) {
            slotsBySpecies.get(previous)?.delete(slot);
            bumpSpeciesVersion(previous);
        }
        slotSpecies[slot] = species;
        let speciesSlots = slotsBySpecies.get(species);
        if (!speciesSlots) {
            speciesSlots = new Set();
            slotsBySpecies.set(species, speciesSlots);
        }
        speciesSlots.add(slot);
    }

    function reportPresence(entry: FaunaPresenceInput) {
        if (disposed) {
            return;
        }

        let slot = slotById.get(entry.id);
        if (slot === undefined) {
            slot = allocateSlot();
            slotById.set(entry.id, slot);
            slotIds[slot] = entry.id;
            stats.actorCount = slotById.size;
            requestStatsPublish();
        }

        setSlotSpecies(slot, entry.species);
        slotBehaviors[slot] = entry.behavior;
        const offset = slot * presenceStride;
        presenceTransforms[offset + presenceX] = entry.position.x;
        presenceTransforms[offset + presenceY] = entry.position.y;
        presenceTransforms[offset + presenceZ] = entry.position.z;
        presenceTransforms[offset + presenceUpdatedAt] = entry.updatedAt;
        setSlotCell(
            slot,
            spatialCellKey(
                spatialCellCoordinate(entry.position.x, spatialCellSize),
                spatialCellCoordinate(entry.position.z, spatialCellSize),
            ),
        );
        bumpSpeciesVersion(entry.species);
        stats.presenceReportCount += 1;
    }

    function readPresence(slot: number): AnimalPresenceEntry {
        const offset = slot * presenceStride;
        return {
            behavior: slotBehaviors[slot] ?? '',
            id: slotIds[slot] ?? '',
            position: {
                x: presenceTransforms[offset + presenceX],
                y: presenceTransforms[offset + presenceY],
                z: presenceTransforms[offset + presenceZ],
            },
            species: slotSpecies[slot] ?? '',
            updatedAt: presenceTransforms[offset + presenceUpdatedAt],
        };
    }

    function slotMatches(slot: number, query: FaunaPresenceQuery) {
        if (slotIds[slot] === undefined) {
            return false;
        }
        if (
            query.species !== undefined &&
            slotSpecies[slot] !== query.species
        ) {
            return false;
        }
        if (
            query.behavior !== undefined &&
            slotBehaviors[slot] !== query.behavior
        ) {
            return false;
        }
        const offset = slot * presenceStride;
        if (
            query.maxAgeSeconds !== undefined &&
            query.now !== undefined &&
            query.now - presenceTransforms[offset + presenceUpdatedAt] >
                query.maxAgeSeconds
        ) {
            return false;
        }
        if (query.center && query.radius !== undefined) {
            const distance = Math.hypot(
                presenceTransforms[offset + presenceX] - query.center.x,
                presenceTransforms[offset + presenceY] - query.center.y,
                presenceTransforms[offset + presenceZ] - query.center.z,
            );
            if (distance > query.radius) {
                return false;
            }
        }

        return true;
    }

    function collectCandidateSlots(query: FaunaPresenceQuery) {
        if (query.center && query.radius !== undefined) {
            const minCellX = spatialCellCoordinate(
                query.center.x - query.radius,
                spatialCellSize,
            );
            const maxCellX = spatialCellCoordinate(
                query.center.x + query.radius,
                spatialCellSize,
            );
            const minCellZ = spatialCellCoordinate(
                query.center.z - query.radius,
                spatialCellSize,
            );
            const maxCellZ = spatialCellCoordinate(
                query.center.z + query.radius,
                spatialCellSize,
            );
            const cellCount =
                (maxCellX - minCellX + 1) * (maxCellZ - minCellZ + 1);
            if (cellCount <= slotsByCell.size) {
                const slots: number[] = [];
                for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
                    for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ += 1) {
                        const cell = slotsByCell.get(
                            spatialCellKey(cellX, cellZ),
                        );
                        if (cell) {
                            for (const slot of cell) {
                                slots.push(slot);
                            }
                        }
                    }
                }
                return slots;
            }
        }

        if (query.species !== undefined) {
            return Array.from(slotsBySpecies.get(query.species) ?? []);
        }

        return Array.from(slotById.values());
    }

    /**
     * Returns fresh presence entries ordered by actor id, matching the order
     * species observed from the previous store-backed registry.
     */
    function queryPresences(query: FaunaPresenceQuery = {}) {
        stats.presenceQueryCount += 1;
        const entries: AnimalPresenceEntry[] = [];
        for (const slot of collectCandidateSlots(query)) {
            if (slotMatches(slot, query)) {
                entries.push(readPresence(slot));
            }
        }

        return entries.sort((left, right) => left.id.localeCompare(right.id));
    }

    /**
     * Cached per-species snapshot, rebuilt only after a member of that
     * species reports or leaves. Safe to read every frame.
     */
    function getSpeciesPresences(
        species: string,
    ): readonly AnimalPresenceEntry[] {
        const version = speciesVersions.get(species) ?? 0;
        const cached = speciesSnapshots.get(species);
        if (cached && cached.version === version) {
            return cached.entries;
        }

        stats.presenceSnapshotBuildCount += 1;
        const entries = Array.from(slotsBySpecies.get(species) ?? [])
            .map(readPresence)
            .sort((left, right) => left.id.localeCompare(right.id));
        speciesSnapshots.set(species, { entries, version });
        return entries;
    }

    function deletePresence(id: string) {
        const slot = slotById.get(id);
        if (slot === undefined) {
            return false;
        }

        slotById.delete(id);
        const species = slotSpecies[slot];
        if (species !== undefined) {
            slotsBySpecies.get(species)?.delete(slot);
            bumpSpeciesVersion(species);
        }
        const cellKey = slotCellKeys[slot];
        if (!Number.isNaN(cellKey)) {
            const cell = slotsByCell.get(cellKey);
            cell?.delete(slot);
            if (cell && cell.size === 0) {
                slotsByCell.delete(cellKey);
            }
        }
        slotIds[slot] = undefined;
        slotSpecies[slot] = undefined;
        slotBehaviors[slot] = undefined;
        slotCellKeys[slot] = Number.NaN;
        presenceTransforms.fill(
            0,
            slot * presenceStride,
            (slot + 1) * presenceStride,
        );
        freeSlots.push(slot);
        stats.actorCount = slotById.size;
        requestStatsPublish();
        return true;
    }

    function cancelTrailingDebugPublish() {
        if (cancelTrailingPublish !== null) {
            cancelTrailingPublish();
            cancelTrailingPublish = null;
        }
    }

    function getDebugEntries(): readonly AnimalDebugEntry[] {
        if (debugEntriesSnapshotVersion !== debugLiveVersion) {
            debugEntriesSnapshot = Array.from(debugEntries.values()).sort(
                compareDebugEntries,
            );
            debugEntriesSnapshotVersion = debugLiveVersion;
        }

        return debugEntriesSnapshot;
    }

    function flushDebugEntries(now?: number) {
        cancelTrailingDebugPublish();
        if (disposed) {
            return false;
        }
        if (publishedDebugVersion === debugVersion) {
            stats.debugSkippedPublishCount += 1;
            return false;
        }

        publishedDebugVersion = debugVersion;
        if (now !== undefined) {
            lastDebugPublishAt = now;
        }
        stats.debugPublishCount += 1;
        publishDebugEntries([...getDebugEntries()]);
        requestStatsPublish();
        return true;
    }

    function scheduleTrailingDebugPublish(delaySeconds: number) {
        if (cancelTrailingPublish !== null || disposed) {
            return;
        }

        cancelTrailingPublish = schedule(
            () => {
                cancelTrailingPublish = null;
                flushDebugEntries();
            },
            Math.max(0, delaySeconds * 1000),
        );
    }

    function requestDebugPublish(now: number) {
        if (publishedDebugVersion === debugVersion) {
            return;
        }

        const elapsed = now - lastDebugPublishAt;
        // A smaller clock means a restarted root clock; publish immediately.
        if (elapsed >= debugPublishIntervalSeconds || elapsed < 0) {
            flushDebugEntries(now);
            return;
        }

        scheduleTrailingDebugPublish(debugPublishIntervalSeconds - elapsed);
    }

    function reportDebug(entry: AnimalDebugEntry) {
        if (disposed) {
            return;
        }

        stats.debugReportCount += 1;
        const previous = debugEntries.get(entry.id);
        debugEntries.set(entry.id, entry);
        debugLiveVersion += 1;
        stats.debugEntryCount = debugEntries.size;
        if (previous && areAnimalDebugEntriesEquivalent(previous, entry)) {
            return;
        }

        debugVersion += 1;
        requestDebugPublish(entry.updatedAt);
    }

    function deleteDebug(id: string) {
        if (!debugEntries.delete(id)) {
            return false;
        }

        stats.debugEntryCount = debugEntries.size;
        debugVersion += 1;
        debugLiveVersion += 1;
        // Removals happen in bursts during unmounts; coalesce into one write.
        scheduleTrailingDebugPublish(0);
        return true;
    }

    function removeActor(id: string) {
        const removedPresence = deletePresence(id);
        const removedDebug = deleteDebug(id);
        if (removedPresence || removedDebug) {
            stats.removedActorCount += 1;
        }
    }

    function recordActorPose(posed: boolean) {
        if (posed) {
            stats.actorPoseUpdateCount += 1;
        } else {
            stats.actorPoseSkipCount += 1;
        }
    }

    function dispose() {
        cancelTrailingDebugPublish();
        cancelStatsPublish?.();
        cancelStatsPublish = null;
        disposed = true;
    }

    return {
        dispose,
        flushDebugEntries,
        getDebugEntries,
        getSpeciesPresences,
        getStats: (): FaunaWorldStats => ({ ...stats }),
        hasActor: (id: string) => slotById.has(id) || debugEntries.has(id),
        queryPresences,
        recordActorPose,
        removeActor,
        removeDebug: (id: string) => {
            deleteDebug(id);
        },
        removePresence: (id: string) => {
            deletePresence(id);
        },
        reportDebug,
        reportPresence,
    };
}

export type FaunaWorld = ReturnType<typeof createFaunaWorld>;
