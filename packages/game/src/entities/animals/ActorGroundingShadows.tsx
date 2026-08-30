'use client';

import { useFrame } from '@react-three/fiber';
import {
    createContext,
    type PropsWithChildren,
    useCallback,
    useContext,
    useLayoutEffect,
    useMemo,
    useRef,
} from 'react';
import {
    DoubleSide,
    DynamicDrawUsage,
    type InstancedMesh,
    Matrix4,
    PlaneGeometry,
    Quaternion,
    ShaderMaterial,
    Vector3,
} from 'three';
import { updateGameProfileMetadata } from '../../scene/gameProfileMetadata';
import { useOptionalGameState } from '../../useGameState';
import {
    type ActorGroundingShadowRegistration,
    ActorGroundingShadowRegistry,
    type ActorGroundingShadowSpeciesCounts,
    type ActorGroundingShadowState,
    actorGroundingShadowCapacity,
    actorGroundingShadowProfiles,
    type GroundingShadowProfile,
    type PlacementGroundingShadowRegistration,
    resolveGroundingShadow,
} from './actorGroundingShadowRegistry';

const actorGroundingShadowGeometry = new PlaneGeometry(2, 2);
actorGroundingShadowGeometry.rotateX(-Math.PI / 2);
actorGroundingShadowGeometry.name = 'ActorGroundingShadowGeometry';
const actorGroundingShadowProfileReportIntervalSeconds = 0.25;

const actorGroundingShadowMaterial = new ShaderMaterial({
    depthTest: true,
    depthWrite: false,
    fragmentShader: `
        varying float vActorShadowOpacity;
        varying vec2 vActorShadowUv;

        void main() {
            float radiusSquared = dot(vActorShadowUv, vActorShadowUv);
            if (radiusSquared >= 1.0 || vActorShadowOpacity <= 0.0) {
                discard;
            }

            float radialFade = 1.0 - smoothstep(0.08, 1.0, radiusSquared);
            float alpha = vActorShadowOpacity * radialFade * radialFade;
            if (alpha <= 0.001) {
                discard;
            }

            gl_FragColor = vec4(0.0, 0.0, 0.0, alpha);
        }
    `,
    side: DoubleSide,
    transparent: true,
    vertexShader: `
        varying float vActorShadowOpacity;
        varying vec2 vActorShadowUv;

        void main() {
            vActorShadowUv = uv * 2.0 - 1.0;

            #ifdef USE_INSTANCING
                vActorShadowOpacity = clamp(
                    length(instanceMatrix[1].xyz),
                    0.0,
                    1.0
                );
                vec4 worldPosition =
                    modelMatrix * instanceMatrix * vec4(position, 1.0);
            #else
                vActorShadowOpacity = 0.0;
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            #endif

            gl_Position =
                projectionMatrix * viewMatrix * worldPosition;
        }
    `,
});
actorGroundingShadowMaterial.name = 'ActorGroundingShadowMaterial';
actorGroundingShadowMaterial.toneMapped = false;

type ActorGroundingShadowContextValue = {
    enabled: boolean;
    registry: ActorGroundingShadowRegistry;
};

type ActorGroundingShadowProfileSnapshot = {
    batchCount: number;
    capacity: number;
    count: number;
    droppedCount: number;
    primaryCasterCount: number;
    placementCount: number;
    placementDroppedCount: number;
    placementPeakCount: number;
    speciesCounts: ActorGroundingShadowSpeciesCounts;
    updateCount: number;
    visibleCount: number;
};

const ActorGroundingShadowContext =
    createContext<ActorGroundingShadowContextValue | null>(null);
const actorGroundingShadowProfileSnapshots = new Map<
    symbol,
    ActorGroundingShadowProfileSnapshot
>();

const hiddenMatrix = new Matrix4().makeScale(0, 0, 0);
const upAxis = new Vector3(0, 1, 0);

function disableRaycast() {
    return undefined;
}

function publishActorGroundingShadowProfile() {
    const speciesCounts: Record<string, number> = {};
    const aggregate = {
        batchCount: 0,
        capacity: 0,
        count: 0,
        droppedCount: 0,
        placementCount: 0,
        placementDroppedCount: 0,
        placementPeakCount: 0,
        primaryCasterCount: 0,
        speciesCounts,
        updateCount: 0,
        visibleCount: 0,
    };
    for (const snapshot of actorGroundingShadowProfileSnapshots.values()) {
        aggregate.batchCount += snapshot.batchCount;
        aggregate.capacity += snapshot.capacity;
        aggregate.count += snapshot.count;
        aggregate.droppedCount += snapshot.droppedCount;
        aggregate.placementCount += snapshot.placementCount;
        aggregate.placementDroppedCount += snapshot.placementDroppedCount;
        aggregate.placementPeakCount += snapshot.placementPeakCount;
        aggregate.primaryCasterCount += snapshot.primaryCasterCount;
        for (const [species, count] of Object.entries(snapshot.speciesCounts)) {
            aggregate.speciesCounts[species] =
                (aggregate.speciesCounts[species] ?? 0) + count;
        }
        aggregate.updateCount += snapshot.updateCount;
        aggregate.visibleCount += snapshot.visibleCount;
    }

    updateGameProfileMetadata({
        actorGroundingShadowBatchCount: aggregate.batchCount,
        actorGroundingShadowCapacity: aggregate.capacity,
        actorGroundingShadowCount: aggregate.count,
        actorGroundingShadowDroppedCount: aggregate.droppedCount,
        actorGroundingShadowPrimaryCasterCount: aggregate.primaryCasterCount,
        actorGroundingShadowSpeciesCounts: aggregate.speciesCounts,
        actorGroundingShadowUpdateCount: aggregate.updateCount,
        actorGroundingShadowVisibleCount: aggregate.visibleCount,
        placementProjectedShadowCount: aggregate.placementCount,
        placementProjectedShadowDroppedCount: aggregate.placementDroppedCount,
        placementProjectedShadowPeakCount: aggregate.placementPeakCount,
    });
}

function clearActorGroundingShadowProfile(owner: symbol) {
    if (actorGroundingShadowProfileSnapshots.delete(owner)) {
        publishActorGroundingShadowProfile();
    }
}

function reportActorGroundingShadowProfile({
    batchCount,
    owner,
    placementPeakCount,
    registry,
    visibleCount,
}: {
    batchCount: number;
    owner: symbol;
    placementPeakCount: number;
    registry: ActorGroundingShadowRegistry;
    visibleCount: number;
}) {
    const stats = registry.getStats();
    actorGroundingShadowProfileSnapshots.set(owner, {
        batchCount,
        capacity: stats.capacity,
        count: stats.registeredCount,
        droppedCount: stats.droppedCount,
        placementCount: stats.placementRegisteredCount,
        placementDroppedCount: stats.placementDroppedCount,
        placementPeakCount,
        primaryCasterCount: stats.primaryCasterCount,
        speciesCounts: registry.getSpeciesCounts(),
        updateCount: stats.updateCount,
        visibleCount,
    });
    publishActorGroundingShadowProfile();
}

function ActorGroundingShadowBatch({
    owner,
    registry,
}: {
    owner: symbol;
    registry: ActorGroundingShadowRegistry;
}) {
    const meshRef = useRef<InstancedMesh | null>(null);
    const snowCoverage = useOptionalGameState((state) => state.snowCoverage, 0);
    const batchCountRef = useRef(0);
    const lastSnowCoverageRef = useRef(Number.NaN);
    const lastProfileReportAtRef = useRef(Number.NEGATIVE_INFINITY);
    const lastVersionRef = useRef(-1);
    const placementPeakCountRef = useRef(0);
    const previousDrawCountRef = useRef(0);
    const profileReportPendingRef = useRef(false);
    const visibleCountRef = useRef(0);
    const scratch = useMemo(
        () => ({
            matrix: new Matrix4(),
            position: new Vector3(),
            quaternion: new Quaternion(),
            scale: new Vector3(),
        }),
        [],
    );

    useLayoutEffect(() => {
        const mesh = meshRef.current;
        if (!mesh) {
            return;
        }

        mesh.count = 0;
        mesh.instanceMatrix.setUsage(DynamicDrawUsage);
        reportActorGroundingShadowProfile({
            batchCount: 0,
            owner,
            placementPeakCount: 0,
            registry,
            visibleCount: 0,
        });

        return () => {
            clearActorGroundingShadowProfile(owner);
        };
    }, [owner, registry]);

    useFrame(({ clock }) => {
        const mesh = meshRef.current;
        if (!mesh) {
            return;
        }

        const version = registry.getVersion();
        const matricesChanged =
            lastVersionRef.current !== version ||
            !Object.is(lastSnowCoverageRef.current, snowCoverage);
        if (matricesChanged) {
            const entries = registry.getEntries();
            const drawCount =
                entries.length === 0
                    ? 0
                    : Math.max(...entries.map((entry) => entry.slot)) + 1;
            const clearCount = Math.max(
                previousDrawCountRef.current,
                drawCount,
            );
            for (let slot = 0; slot < clearCount; slot += 1) {
                mesh.setMatrixAt(slot, hiddenMatrix);
            }

            let visibleCount = 0;
            for (const entry of entries) {
                const resolved = resolveGroundingShadow({
                    profile:
                        entry.kind === 'placement'
                            ? entry.profile
                            : actorGroundingShadowProfiles[entry.species],
                    snowCoverage,
                    state: entry.state,
                });
                if (!resolved.visible) {
                    continue;
                }

                if (entry.kind !== 'placement') {
                    visibleCount += 1;
                }
                scratch.position.set(resolved.x, resolved.y, resolved.z);
                scratch.quaternion.setFromAxisAngle(upAxis, resolved.yaw);
                scratch.scale.set(
                    resolved.halfWidth,
                    resolved.opacity,
                    resolved.halfLength,
                );
                scratch.matrix.compose(
                    scratch.position,
                    scratch.quaternion,
                    scratch.scale,
                );
                mesh.setMatrixAt(entry.slot, scratch.matrix);
            }

            mesh.count = drawCount;
            mesh.instanceMatrix.clearUpdateRanges();
            if (drawCount > 0) {
                mesh.instanceMatrix.addUpdateRange(0, drawCount * 16);
                mesh.instanceMatrix.needsUpdate = true;
            }

            const stats = registry.getStats();
            batchCountRef.current = stats.registeredCount > 0 ? 1 : 0;
            placementPeakCountRef.current = Math.max(
                placementPeakCountRef.current,
                stats.placementRegisteredCount,
            );
            previousDrawCountRef.current = drawCount;
            visibleCountRef.current = visibleCount;
            lastSnowCoverageRef.current = snowCoverage;
            lastVersionRef.current = version;
            profileReportPendingRef.current = true;
        }

        if (
            profileReportPendingRef.current &&
            clock.elapsedTime - lastProfileReportAtRef.current >=
                actorGroundingShadowProfileReportIntervalSeconds
        ) {
            lastProfileReportAtRef.current = clock.elapsedTime;
            profileReportPendingRef.current = false;
            reportActorGroundingShadowProfile({
                batchCount: batchCountRef.current,
                owner,
                placementPeakCount: placementPeakCountRef.current,
                registry,
                visibleCount: visibleCountRef.current,
            });
        }
    });

    return (
        <instancedMesh
            ref={meshRef}
            args={[
                actorGroundingShadowGeometry,
                actorGroundingShadowMaterial,
                actorGroundingShadowCapacity,
            ]}
            castShadow={false}
            dispose={null}
            frustumCulled={false}
            name="ActorGroundingShadows"
            raycast={disableRaycast}
            receiveShadow={false}
            renderOrder={1}
        />
    );
}

export function ActorGroundingShadowProvider({
    children,
    enabled,
}: PropsWithChildren<{ enabled: boolean }>) {
    const registry = useMemo(() => new ActorGroundingShadowRegistry(), []);
    const profileOwner = useMemo(
        () => Symbol('actor-grounding-shadow-profile-owner'),
        [],
    );
    const context = useMemo(() => ({ enabled, registry }), [enabled, registry]);

    useLayoutEffect(() => {
        if (!enabled) {
            clearActorGroundingShadowProfile(profileOwner);
        }
    }, [enabled, profileOwner]);

    return (
        <ActorGroundingShadowContext.Provider value={context}>
            {children}
            {enabled && (
                <ActorGroundingShadowBatch
                    owner={profileOwner}
                    registry={registry}
                />
            )}
        </ActorGroundingShadowContext.Provider>
    );
}

export function useActorGroundingShadow({
    id,
    primaryCasterCount,
    species,
}: ActorGroundingShadowRegistration) {
    const context = useContext(ActorGroundingShadowContext);
    if (!context) {
        throw new Error('Missing ActorGroundingShadowProvider in scene tree');
    }
    const { enabled, registry } = context;

    useLayoutEffect(() => {
        if (!enabled) {
            return;
        }

        const registration = registry.register({
            id,
            primaryCasterCount,
            species,
        });
        return registration.unregister;
    }, [enabled, id, primaryCasterCount, registry, species]);

    const update = useCallback(
        (state: ActorGroundingShadowState) => {
            if (enabled) {
                registry.update(id, state);
            }
        },
        [enabled, id, registry],
    );

    return enabled ? update : null;
}

export function usePlacementGroundingShadow({
    id,
    profile,
    state,
}: Omit<PlacementGroundingShadowRegistration, 'kind'> & {
    state: ActorGroundingShadowState;
}) {
    const context = useContext(ActorGroundingShadowContext);
    if (!context) {
        throw new Error('Missing ActorGroundingShadowProvider in scene tree');
    }
    const { enabled, registry } = context;
    const {
        baseHalfLength,
        baseHalfWidth,
        baseOpacity,
        cutoffHeight,
        maxFootprintScale,
    } = profile;
    const { actorY, receiverY, visible, x, yaw, z } = state;

    useLayoutEffect(() => {
        if (!enabled) {
            return;
        }

        const placementProfile: GroundingShadowProfile = {
            baseHalfLength,
            baseHalfWidth,
            baseOpacity,
            cutoffHeight,
            maxFootprintScale,
        };
        const registration = registry.register({
            id,
            kind: 'placement',
            profile: placementProfile,
        });
        registry.update(id, {
            actorY,
            receiverY,
            visible,
            x,
            yaw,
            z,
        });
        return registration.unregister;
    }, [
        actorY,
        baseHalfLength,
        baseHalfWidth,
        baseOpacity,
        cutoffHeight,
        enabled,
        id,
        maxFootprintScale,
        receiverY,
        registry,
        visible,
        x,
        yaw,
        z,
    ]);
}
