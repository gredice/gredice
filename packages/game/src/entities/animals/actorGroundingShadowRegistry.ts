export type ActorGroundingShadowSpecies =
    | 'avatar'
    | 'beachBall'
    | 'bee'
    | 'bird'
    | 'butterfly'
    | 'cat'
    | 'chicken'
    | 'cow'
    | 'dog'
    | 'goat'
    | 'frog'
    | 'horse'
    | 'ladybug'
    | 'piglet'
    | 'rabbit'
    | 'sheep'
    | 'slug'
    | 'squirrel';

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
    kind?: 'actor';
    primaryCasterCount: number;
    species: ActorGroundingShadowSpecies;
};

export type GroundingShadowProfile = {
    baseHalfLength: number;
    baseHalfWidth: number;
    baseOpacity: number;
    cutoffHeight: number;
    maxFootprintScale: number;
};

export type PlacementGroundingShadowRegistration = {
    id: string;
    kind: 'placement';
    profile: GroundingShadowProfile;
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

export type ActorGroundingShadowRegistryEntry = (
    | ActorGroundingShadowRegistration
    | PlacementGroundingShadowRegistration
) & {
    slot: number;
    state: ActorGroundingShadowState;
};

export type ActorGroundingShadowRegistryStats = {
    capacity: number;
    droppedCount: number;
    placementDroppedCount: number;
    placementRegisteredCount: number;
    placementUpdateCount: number;
    primaryCasterCount: number;
    registeredCount: number;
    updateCount: number;
};

export type ActorGroundingShadowSpeciesCounts = Partial<
    Record<ActorGroundingShadowSpecies, number>
>;

export function countActorGroundingShadowSpecies(
    entries: readonly ActorGroundingShadowRegistryEntry[],
) {
    const counts: ActorGroundingShadowSpeciesCounts = {};
    for (const entry of entries) {
        if (entry.kind === 'placement') {
            continue;
        }
        counts[entry.species] = (counts[entry.species] ?? 0) + 1;
    }

    return counts;
}

export const actorGroundingShadowCapacity = 128;
export const actorGroundingShadowSurfaceLift = 0.006;
export const actorGroundingShadowSnowLift = 0.012;

export const actorGroundingShadowProfiles = {
    avatar: {
        baseHalfLength: 0.24,
        baseHalfWidth: 0.18,
        baseOpacity: 0.32,
        cutoffHeight: 2,
        maxFootprintScale: 1.7,
    },
    beachBall: {
        baseHalfLength: 0.23,
        baseHalfWidth: 0.23,
        baseOpacity: 0.28,
        cutoffHeight: 0.42,
        maxFootprintScale: 1.3,
    },
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
    butterfly: {
        baseHalfLength: 0.052,
        baseHalfWidth: 0.036,
        baseOpacity: 0.18,
        cutoffHeight: 0.72,
        maxFootprintScale: 2,
    },
    cat: {
        baseHalfLength: 0.38,
        baseHalfWidth: 0.23,
        baseOpacity: 0.34,
        cutoffHeight: 1.2,
        maxFootprintScale: 1.65,
    },
    chicken: {
        baseHalfLength: 0.24,
        baseHalfWidth: 0.17,
        baseOpacity: 0.3,
        cutoffHeight: 0.8,
        maxFootprintScale: 1.55,
    },
    cow: {
        baseHalfLength: 0.98,
        baseHalfWidth: 0.43,
        baseOpacity: 0.4,
        cutoffHeight: 1.8,
        maxFootprintScale: 1.45,
    },
    dog: {
        baseHalfLength: 0.52,
        baseHalfWidth: 0.31,
        baseOpacity: 0.36,
        cutoffHeight: 1.6,
        maxFootprintScale: 1.7,
    },
    goat: {
        baseHalfLength: 0.42,
        baseHalfWidth: 0.25,
        baseOpacity: 0.35,
        cutoffHeight: 1.3,
        maxFootprintScale: 1.65,
    },
    frog: {
        baseHalfLength: 0.2,
        baseHalfWidth: 0.17,
        baseOpacity: 0.28,
        cutoffHeight: 0.75,
        maxFootprintScale: 1.55,
    },
    horse: {
        baseHalfLength: 0.76,
        baseHalfWidth: 0.34,
        baseOpacity: 0.38,
        cutoffHeight: 2,
        maxFootprintScale: 1.55,
    },
    ladybug: {
        baseHalfLength: 0.0375,
        baseHalfWidth: 0.026,
        baseOpacity: 0.2,
        cutoffHeight: 0.35,
        maxFootprintScale: 1.5,
    },
    piglet: {
        baseHalfLength: 0.36,
        baseHalfWidth: 0.24,
        baseOpacity: 0.34,
        cutoffHeight: 1.1,
        maxFootprintScale: 1.6,
    },
    rabbit: {
        baseHalfLength: 0.204,
        baseHalfWidth: 0.132,
        baseOpacity: 0.32,
        cutoffHeight: 0.54,
        maxFootprintScale: 1.6,
    },
    sheep: {
        baseHalfLength: 0.47,
        baseHalfWidth: 0.29,
        baseOpacity: 0.35,
        cutoffHeight: 1.2,
        maxFootprintScale: 1.65,
    },
    slug: {
        baseHalfLength: 0.175,
        baseHalfWidth: 0.07,
        baseOpacity: 0.2,
        cutoffHeight: 0.154,
        maxFootprintScale: 1.2,
    },
    squirrel: {
        baseHalfLength: 0.133,
        baseHalfWidth: 0.092,
        baseOpacity: 0.3,
        cutoffHeight: 0.462,
        maxFootprintScale: 1.55,
    },
} satisfies Record<ActorGroundingShadowSpecies, GroundingShadowProfile>;

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
    return resolveGroundingShadow({
        profile: actorGroundingShadowProfiles[species],
        snowCoverage,
        state,
    });
}

export function resolveGroundingShadow({
    profile,
    snowCoverage,
    state,
}: {
    profile: GroundingShadowProfile;
    snowCoverage: number;
    state: ActorGroundingShadowState;
}): ResolvedActorGroundingShadow {
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
    private readonly droppedIds = new Map<string, 'actor' | 'placement'>();
    private readonly freeSlots: number[] = [];
    private nextSlot = 0;
    private placementDroppedCount = 0;
    private placementUpdateCount = 0;
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

    getSpeciesCounts() {
        return countActorGroundingShadowSpecies(this.getEntries());
    }

    getStats(): ActorGroundingShadowRegistryStats {
        let placementRegisteredCount = 0;
        let primaryCasterCount = 0;
        let registeredCount = 0;
        for (const entry of this.entries.values()) {
            if (entry.kind === 'placement') {
                placementRegisteredCount += 1;
            } else {
                registeredCount += 1;
                primaryCasterCount += entry.primaryCasterCount;
            }
        }
        let droppedCount = 0;
        for (const kind of this.droppedIds.values()) {
            if (kind === 'actor') {
                droppedCount += 1;
            }
        }

        return {
            capacity: this.capacity,
            droppedCount,
            placementDroppedCount: this.placementDroppedCount,
            placementRegisteredCount,
            placementUpdateCount: this.placementUpdateCount,
            primaryCasterCount,
            registeredCount,
            updateCount: this.updateCount,
        };
    }

    getVersion() {
        return this.version;
    }

    register(
        registration:
            | ActorGroundingShadowRegistration
            | PlacementGroundingShadowRegistration,
    ) {
        const { id } = registration;
        if (id.length === 0) {
            throw new Error('Actor grounding-shadow registration needs an id');
        }
        if (this.entries.has(id) || this.droppedIds.has(id)) {
            throw new Error(
                `Actor grounding-shadow id "${id}" is already registered`,
            );
        }
        if (
            registration.kind !== 'placement' &&
            (!Number.isInteger(registration.primaryCasterCount) ||
                registration.primaryCasterCount < 0)
        ) {
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

            this.droppedIds.set(
                id,
                registration.kind === 'placement' ? 'placement' : 'actor',
            );
            if (registration.kind === 'placement') {
                this.placementDroppedCount += 1;
            }
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

        const entry: ActorGroundingShadowRegistryEntry =
            registration.kind === 'placement'
                ? {
                      id,
                      kind: 'placement',
                      profile: registration.profile,
                      slot,
                      state: hiddenActorGroundingShadowState,
                  }
                : {
                      id,
                      kind: 'actor',
                      primaryCasterCount: registration.primaryCasterCount,
                      slot,
                      species: registration.species,
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
        if (entry.kind === 'placement') {
            this.placementUpdateCount += 1;
        } else {
            this.updateCount += 1;
        }
        this.publishChange();
        return true;
    }

    private publishChange() {
        this.version += 1;
    }
}
