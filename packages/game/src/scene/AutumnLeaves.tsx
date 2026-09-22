import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import {
    Color,
    DoubleSide,
    Frustum,
    InstancedMesh,
    Matrix4,
    MeshStandardMaterial,
    Object3D,
    OrthographicCamera,
    Sphere,
    Vector3,
} from 'three';
import { useEntityBlockInstances } from '../entities/EntityInstancesBlock';
import { getAutumnGroundBlocks } from '../entities/groundDecorations/autumnGroundPlacements';
import { useAutumnState } from '../hooks/useAutumnState';
import { useLiveTime } from '../hooks/useLiveTime';
import type { Stack } from '../types/Stack';
import { useGameState } from '../useGameState';
import { useAutumnSources } from './AutumnSources';
import { getAutumnAccumulationYear } from './autumnAccumulation';
import { createAutumnLeafGeometry } from './autumnLeafGeometry';
import {
    autumnGustCaps,
    createAutumnGustAnchors,
    resolveAutumnGustCount,
    sampleAutumnGustLeaf,
    sampleAutumnGustWindow,
} from './autumnLeafGusts';
import {
    autumnLeafCaps,
    createAutumnLeafDescriptor,
    resolveAutumnLeafCount,
    sampleAutumnLeaf,
    writeAutumnLeafSourceCounts,
} from './autumnLeafMotion';
import { getAutumnLeafColor } from './autumnPalette';
import { updateGameProfileMetadata } from './gameProfileMetadata';
import type { GameQualityProfileTier } from './gameQuality';
import {
    useSceneFixedTimeSeconds,
    useSceneRenderRequest,
    useSceneRuntimeVisible,
    useSceneTimeInvalidation,
    useSceneTimeUniform,
} from './SceneTime';

const reducedMotionQuery = '(prefers-reduced-motion: reduce)';
function subscribeReducedMotion(listener: () => void) {
    const query = window.matchMedia(reducedMotionQuery);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
}
function getReducedMotion() {
    return window.matchMedia(reducedMotionQuery).matches;
}

export function AutumnLeaves({
    tier,
    stacks,
    gardenId,
    windSpeed = 0,
    windDirection = 0,
    rain = 0,
    snow = 0,
    enabled = true,
}: {
    tier: GameQualityProfileTier;
    stacks?: Stack[];
    gardenId?: number;
    windSpeed?: number;
    windDirection?: number;
    rain?: number;
    snow?: number;
    enabled?: boolean;
}) {
    const sources = useAutumnSources();
    const autumn = useAutumnState();
    const reducedMotion = useSyncExternalStore(
        subscribeReducedMotion,
        getReducedMotion,
        () => false,
    );
    const snowCoverage = useGameState((state) => state.snowCoverage);
    const year = getAutumnAccumulationYear(useLiveTime());
    const exposedBlocks = useMemo(
        () => getAutumnGroundBlocks(stacks),
        [stacks],
    );
    const exposedNames = useMemo(
        () => [...new Set(exposedBlocks.map(({ block }) => block.name))],
        [exposedBlocks],
    );
    const groundInstances = useEntityBlockInstances({
        stacks,
        names: exposedNames,
        yOffset: 0.2,
    });
    const gustAnchors = useMemo(() => {
        const treePosition = new Vector3();
        const trees = sources.map(({ id, object }) => {
            object.getWorldPosition(treePosition);
            return { id, x: treePosition.x, z: treePosition.z };
        });
        return createAutumnGustAnchors({
            instances: groundInstances ?? [],
            exposedBlockIds: new Set(
                exposedBlocks.map(({ block }) => block.id),
            ),
            trees,
            gardenId,
            year,
        });
    }, [exposedBlocks, gardenId, groundInstances, sources, year]);
    const visible = useSceneRuntimeVisible();
    const fixedTime = useSceneFixedTimeSeconds();
    const time = useSceneTimeUniform();
    const requestRender = useSceneRenderRequest();
    const capacity = autumnLeafCaps[tier];
    const gustCount = resolveAutumnGustCount({
        tier,
        windSpeed,
        rain,
        snow: Math.max(snow, snowCoverage),
        settledLeafAmount: autumn.settledLeafAmount,
        anchorCount: gustAnchors.length,
        enabled: enabled && !reducedMotion,
    });
    const count = resolveAutumnLeafCount(
        tier,
        sources.length,
        autumn.fallingLeafIntensity,
        windSpeed,
        enabled,
    );
    const perTree = resolveAutumnLeafCount(
        tier,
        1,
        autumn.fallingLeafIntensity,
        windSpeed,
        enabled,
    );
    const mesh = useMemo(() => {
        const value = new InstancedMesh(
            createAutumnLeafGeometry(),
            new MeshStandardMaterial({
                color: 'white',
                side: DoubleSide,
                roughness: 0.9,
            }),
            capacity,
        );
        value.name = 'Weather:AutumnLeaves';
        value.count = 0;
        value.frustumCulled = false;
        value.raycast = () => {};
        return value;
    }, [capacity]);
    const descriptors = useMemo(
        () =>
            sources.map((source) => ({
                source,
                origin: new Vector3(),
                leaves: Array.from({ length: 8 }, (_, index) => ({
                    motion: createAutumnLeafDescriptor(source.id, index),
                    color: getAutumnLeafColor(
                        new Color('#458a36'),
                        autumn.foliageColorProgress,
                        `${source.id}:${index}`,
                    ),
                })),
            })),
        [sources, autumn.foliageColorProgress],
    );
    const gustColors = useMemo(
        () =>
            gustAnchors.map((anchor) =>
                Array.from({ length: autumnGustCaps[tier] }, (_, index) =>
                    getAutumnLeafColor(
                        new Color('#458a36'),
                        autumn.foliageColorProgress,
                        `${anchor.id}:${index}`,
                    ),
                ),
            ),
        [gustAnchors, autumn.foliageColorProgress, tier],
    );
    const scratch = useMemo(() => {
        const visibleIndices: number[] = [];
        const visibleGustIndices: number[] = [];
        const allocations: number[] = [];
        return {
            visibleIndices,
            visibleGustIndices,
            allocations,
            lastGustCount: 0,
            peakGustCount: 0,
            transform: new Object3D(),
            frustum: new Frustum(),
            matrix: new Matrix4(),
            sphere: new Sphere(new Vector3(), 2.5),
        };
    }, []);
    useSceneTimeInvalidation(
        'autumn-leaves',
        visible && (count > 0 || gustCount > 0) && fixedTime === undefined,
    );
    // A fixed clock has no continuous frame lease; changes in these inputs still need one render.
    // biome-ignore lint/correctness/useExhaustiveDependencies: Each value deliberately invalidates the scene frame.
    useEffect(() => {
        if (fixedTime !== undefined || (count === 0 && gustCount === 0))
            requestRender('autumn-leaves-change');
    }, [
        count,
        fixedTime,
        gustCount,
        descriptors,
        gustAnchors,
        requestRender,
        visible,
        windDirection,
        windSpeed,
    ]);
    useEffect(
        () => () => {
            mesh.geometry.dispose();
            mesh.material.dispose();
            mesh.dispose();
        },
        [mesh],
    );
    // Reset telemetry when the scene switches garden or autumn year.
    // biome-ignore lint/correctness/useExhaustiveDependencies: Garden and year identity deliberately reset the recorded peak.
    useEffect(() => {
        scratch.peakGustCount = 0;
        updateGameProfileMetadata({ autumnGustPeakCount: 0 });
    }, [gardenId, scratch, year]);
    useEffect(() => {
        updateGameProfileMetadata({
            autumnLeafCapacity: capacity,
            autumnGustCapacity: autumnGustCaps[tier],
        });
        return () =>
            updateGameProfileMetadata({
                autumnLeafCapacity: 0,
                autumnLeafCount: 0,
                autumnGustCapacity: 0,
                autumnGustCount: 0,
                autumnGustPeakCount: 0,
            });
    }, [capacity, tier]);
    useFrame(({ camera }) => {
        let active = 0;
        const gustWindow =
            visible && gustCount > 0
                ? sampleAutumnGustWindow(
                      time.value,
                      gardenId,
                      year,
                      gustAnchors.length,
                  )
                : null;
        let gustAnchorIndex = -1;
        if (gustWindow) {
            scratch.frustum.setFromProjectionMatrix(
                scratch.matrix.multiplyMatrices(
                    camera.projectionMatrix,
                    camera.matrixWorldInverse,
                ),
            );
            scratch.sphere.radius = 0.9;
            scratch.visibleGustIndices.length = 0;
            for (const [index, anchor] of gustAnchors.entries()) {
                scratch.sphere.center.set(anchor.x, anchor.y, anchor.z);
                if (
                    scratch.frustum.intersectsSphere(scratch.sphere) &&
                    (camera instanceof OrthographicCamera ||
                        camera.position.distanceToSquared(
                            scratch.sphere.center,
                        ) <= 900)
                )
                    scratch.visibleGustIndices.push(index);
            }
            if (scratch.visibleGustIndices.length > 0)
                gustAnchorIndex =
                    scratch.visibleGustIndices[
                        gustWindow.anchorIndex %
                            scratch.visibleGustIndices.length
                    ];
        }
        const gustAnchor = gustAnchors[gustAnchorIndex];
        const visibleGust = gustAnchor ? gustCount : 0;
        if (visible && count > 0) {
            scratch.frustum.setFromProjectionMatrix(
                scratch.matrix.multiplyMatrices(
                    camera.projectionMatrix,
                    camera.matrixWorldInverse,
                ),
            );
            scratch.sphere.radius = 2.5;
            scratch.visibleIndices.length = 0;
            for (const [index, { source, origin }] of descriptors.entries()) {
                source.object.getWorldPosition(origin);
                scratch.sphere.center.copy(origin);
                if (
                    !source.object.visible ||
                    (!(camera instanceof OrthographicCamera) &&
                        camera.position.distanceToSquared(origin) > 900) ||
                    !scratch.frustum.intersectsSphere(scratch.sphere)
                )
                    continue;
                scratch.visibleIndices.push(index);
            }
            writeAutumnLeafSourceCounts(
                scratch.allocations,
                scratch.visibleIndices.length,
                perTree,
                capacity - visibleGust,
            );
            for (const [
                visibleIndex,
                descriptorIndex,
            ] of scratch.visibleIndices.entries()) {
                const { origin, leaves } = descriptors[descriptorIndex];
                for (
                    let index = 0;
                    index < scratch.allocations[visibleIndex];
                    index++
                ) {
                    const leaf = leaves[index];
                    const sample = sampleAutumnLeaf(
                        leaf.motion,
                        time.value,
                        windSpeed,
                        windDirection,
                    );
                    scratch.transform.position.set(
                        origin.x + sample.x,
                        origin.y - 0.5 + sample.y,
                        origin.z + sample.z,
                    );
                    scratch.transform.rotation.set(
                        sample.rotation,
                        sample.rotation * 0.7,
                        sample.rotation * 0.3,
                    );
                    scratch.transform.scale.setScalar(sample.scale);
                    scratch.transform.updateMatrix();
                    mesh.setMatrixAt(active, scratch.transform.matrix);
                    mesh.setColorAt(active++, leaf.color);
                }
            }
        }
        if (gustWindow && gustAnchor && visibleGust > 0) {
            for (let index = 0; index < visibleGust; index++) {
                const sample = sampleAutumnGustLeaf(
                    `${gustAnchor.id}:${gustWindow.eventIndex}`,
                    index,
                    gustWindow.progress,
                    windSpeed,
                    windDirection,
                );
                scratch.transform.position.set(
                    gustAnchor.x + sample.x,
                    gustAnchor.y + sample.y,
                    gustAnchor.z + sample.z,
                );
                scratch.transform.rotation.set(
                    sample.rotation * 0.3,
                    sample.rotation,
                    sample.rotation * 0.4,
                );
                scratch.transform.scale.setScalar(sample.scale);
                scratch.transform.updateMatrix();
                mesh.setMatrixAt(active, scratch.transform.matrix);
                mesh.setColorAt(active++, gustColors[gustAnchorIndex][index]);
            }
        }
        scratch.peakGustCount = Math.max(scratch.peakGustCount, visibleGust);
        if (mesh.count !== active || scratch.lastGustCount !== visibleGust)
            updateGameProfileMetadata({
                autumnLeafCount: active,
                autumnGustCount: visibleGust,
                autumnGustPeakCount: scratch.peakGustCount,
            });
        scratch.lastGustCount = visibleGust;
        mesh.count = active;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });
    return <primitive object={mesh} dispose={null} />;
}
