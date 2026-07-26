export type ActorGroundingShadowSpecies = 'bee' | 'bird' | 'cat' | 'dog';

export type ActorGroundingShadowState = {
    actorY: number;
    receiverY: number;
    visible: boolean;
    x: number;
    yaw: number;
    z: number;
};

export type ActorGroundingShadowRegistration = {
    id: string;
    primaryCasterCount: number;
    species: ActorGroundingShadowSpecies;
};

export type ResolvedActorGroundingShadow = {
    halfLength: number;
    halfWidth: number;
    opacity: number;
    visible: boolean;
    x: number;
    y: number;
    yaw: number;
    z: number;
};

export type ActorGroundingShadowRegistryEntry =
    ActorGroundingShadowRegistration & {
        slot: number;
        state: ActorGroundingShadowState;
    };

export type ActorGroundingShadowRegistryStats = {
    capacity: number;
    droppedCount: number;
    primaryCasterCount: number;
    registeredCount: number;
    updateCount: number;
};

type ActorGroundingShadowProfile = {
    baseHalfLength: number;
    baseHalfWidth: number;
    baseOpacity: number;
    cutoffHeight: number;
    maxFootprintScale: number;
};

export const actorGroundingShadowCapacity = 128;
export const actorGroundingShadowSurfaceLift = 0.006;
export const actorGroundingShadowSnowLift = 0.012;

export const actorGroundingShadowProfiles = {
    bee: {
        baseHalfLength: 0.055,
        baseHalfWidth: 0.035,
        baseOpacity: 0.16,
        cutoffHeight: 1.4,
        maxFootprintScale: 1.8,
    },
    bird: {
        baseHalfLength: 0.2,
        baseHalfWidth: 0.14,
        baseOpacity: 0.26,
        cutoffHeight: 2.6,
        maxFootprintScale: 2.1,
    },
    cat: {
        baseHalfLength: 0.38,
        baseHalfWidth: 0.23,
        baseOpacity: 0.34,
        cutoffHeight: 1.2,
        maxFootprintScale: 1.65,
    },
    dog: {
        baseHalfLength: 0.52,
        baseHalfWidth: 0.31,
        baseOpacity: 0.36,
        cutoffHeight: 1.6,
        maxFootprintScale: 1.7,
    },
} satisfies Record<ActorGroundingShadowSpecies, ActorGroundingShadowProfile>;

const hiddenActorGroundingShadowState: ActorGroundingShadowState = {
    actorY: 0,
    receiverY: 0,
    visible: false,
    x: 0,
    yaw: 0,
    z: 0,
};

function clampUnit(value: number) {
    return Math.min(1, Math.max(0, value));
}

function hasFiniteTransform(state: ActorGroundingShadowState) {
    return (
        Number.isFinite(state.actorY) &&
        Number.isFinite(state.receiverY) &&
        Number.isFinite(state.x) &&
        Number.isFinite(state.yaw) &&
        Number.isFinite(state.z)
    );
}

function isSameState(
    left: ActorGroundingShadowState,
    right: ActorGroundingShadowState,
) {
    return (
        Object.is(left.actorY, right.actorY) &&
        Object.is(left.receiverY, right.receiverY) &&
        left.visible === right.visible &&
        Object.is(left.x, right.x) &&
        Object.is(left.yaw, right.yaw) &&
        Object.is(left.z, right.z)
    );
}

export function resolveActorGroundingShadow({
    snowCoverage,
    species,
    state,
}: {
    snowCoverage: number;
    species: ActorGroundingShadowSpecies;
    state: ActorGroundingShadowState;
}): ResolvedActorGroundingShadow {
    const profile = actorGroundingShadowProfiles[species];
    const finiteTransform = hasFiniteTransform(state);
    const actorY = finiteTransform ? state.actorY : 0;
    const receiverY = finiteTransform ? state.receiverY : 0;
    const height = Math.max(0, actorY - receiverY);
    const heightRatio = clampUnit(height / profile.cutoffHeight);
    const remainingOpacity = 1 - heightRatio;
    const footprintScale = 1 + (profile.maxFootprintScale - 1) * heightRatio;
    const finiteSnowCoverage = Number.isFinite(snowCoverage)
        ? clampUnit(snowCoverage)
        : 0;
    const visible =
        state.visible &&
        finiteTransform &&
        height < profile.cutoffHeight &&
        remainingOpacity > 0;

    return {
        halfLength: profile.baseHalfLength * footprintScale,
        halfWidth: profile.baseHalfWidth * footprintScale,
        opacity: visible
            ? profile.baseOpacity * remainingOpacity * remainingOpacity
            : 0,
        visible,
        x: finiteTransform ? state.x : 0,
        y:
            receiverY +
            actorGroundingShadowSurfaceLift +
            finiteSnowCoverage * actorGroundingShadowSnowLift,
        yaw: finiteTransform ? state.yaw : 0,
        z: finiteTransform ? state.z : 0,
    };
}

export class ActorGroundingShadowRegistry {
    private readonly entries = new Map<
        string,
        ActorGroundingShadowRegistryEntry
    >();
    private readonly droppedIds = new Set<string>();
    private readonly freeSlots: number[] = [];
    private nextSlot = 0;
    private updateCount = 0;
    private version = 0;

    constructor(readonly capacity = actorGroundingShadowCapacity) {
        if (!Number.isInteger(capacity) || capacity < 1) {
            throw new Error(
                'Actor grounding-shadow capacity must be a positive integer',
            );
        }
    }

    getEntries() {
        return [...this.entries.values()].sort(
            (left, right) => left.slot - right.slot,
        );
    }

    getStats(): ActorGroundingShadowRegistryStats {
        let primaryCasterCount = 0;
        for (const entry of this.entries.values()) {
            primaryCasterCount += entry.primaryCasterCount;
        }

        return {
            capacity: this.capacity,
            droppedCount: this.droppedIds.size,
            primaryCasterCount,
            registeredCount: this.entries.size,
            updateCount: this.updateCount,
        };
    }

    getVersion() {
        return this.version;
    }

    register({
        id,
        primaryCasterCount,
        species,
    }: ActorGroundingShadowRegistration) {
        if (id.length === 0) {
            throw new Error('Actor grounding-shadow registration needs an id');
        }
        if (this.entries.has(id) || this.droppedIds.has(id)) {
            throw new Error(
                `Actor grounding-shadow id "${id}" is already registered`,
            );
        }
        if (!Number.isInteger(primaryCasterCount) || primaryCasterCount < 0) {
            throw new Error(
                'Actor grounding-shadow primary caster count must be a non-negative integer',
            );
        }

        const reusedSlot = this.freeSlots.shift();
        const slot = reusedSlot ?? this.nextSlot;
        if (slot >= this.capacity) {
            if (reusedSlot !== undefined) {
                this.freeSlots.unshift(reusedSlot);
            }

            this.droppedIds.add(id);
            this.publishChange();

            let registered = true;
            return {
                slot: null,
                unregister: () => {
                    if (!registered) {
                        return;
                    }

                    registered = false;
                    this.droppedIds.delete(id);
                    this.publishChange();
                },
            };
        }
        if (reusedSlot === undefined) {
            this.nextSlot += 1;
        }

        const entry: ActorGroundingShadowRegistryEntry = {
            id,
            primaryCasterCount,
            slot,
            species,
            state: hiddenActorGroundingShadowState,
        };
        this.entries.set(id, entry);
        this.publishChange();

        let registered = true;
        return {
            slot,
            unregister: () => {
                if (!registered || this.entries.get(id) !== entry) {
                    return;
                }

                registered = false;
                this.entries.delete(id);
                this.freeSlots.push(slot);
                this.freeSlots.sort((left, right) => left - right);
                this.publishChange();
            },
        };
    }

    update(id: string, state: ActorGroundingShadowState) {
        const entry = this.entries.get(id);
        if (!entry || isSameState(entry.state, state)) {
            return false;
        }

        entry.state = { ...state };
        this.updateCount += 1;
        this.publishChange();
        return true;
    }

    private publishChange() {
        this.version += 1;
    }
}
