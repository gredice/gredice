import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
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
import { useAutumnState } from '../hooks/useAutumnState';
import { useAutumnSources } from './AutumnSources';
import { createAutumnLeafGeometry } from './autumnLeafGeometry';
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
    useSceneRuntimeVisible,
    useSceneTimeInvalidation,
    useSceneTimeUniform,
} from './SceneTime';

export function AutumnLeaves({
    tier,
    windSpeed = 0,
    windDirection = 0,
    enabled = true,
}: {
    tier: GameQualityProfileTier;
    windSpeed?: number;
    windDirection?: number;
    enabled?: boolean;
}) {
    const sources = useAutumnSources();
    const autumn = useAutumnState();
    const visible = useSceneRuntimeVisible();
    const fixedTime = useSceneFixedTimeSeconds();
    const time = useSceneTimeUniform();
    const capacity = autumnLeafCaps[tier];
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
    const scratch = useMemo(() => {
        const visibleIndices: number[] = [];
        const allocations: number[] = [];
        return {
            visibleIndices,
            allocations,
            transform: new Object3D(),
            frustum: new Frustum(),
            matrix: new Matrix4(),
            sphere: new Sphere(new Vector3(), 2.5),
        };
    }, []);
    useSceneTimeInvalidation(
        'autumn-leaves',
        visible && count > 0 && fixedTime === undefined,
    );
    useEffect(
        () => () => {
            mesh.geometry.dispose();
            mesh.material.dispose();
            mesh.dispose();
        },
        [mesh],
    );
    useEffect(() => {
        updateGameProfileMetadata({ autumnLeafCapacity: capacity });
        return () =>
            updateGameProfileMetadata({
                autumnLeafCapacity: 0,
                autumnLeafCount: 0,
            });
    }, [capacity]);
    useFrame(({ camera }) => {
        let active = 0;
        if (visible && count > 0) {
            scratch.frustum.setFromProjectionMatrix(
                scratch.matrix.multiplyMatrices(
                    camera.projectionMatrix,
                    camera.matrixWorldInverse,
                ),
            );
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
                capacity,
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
        if (mesh.count !== active)
            updateGameProfileMetadata({ autumnLeafCount: active });
        mesh.count = active;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });
    return <primitive object={mesh} dispose={null} />;
}
