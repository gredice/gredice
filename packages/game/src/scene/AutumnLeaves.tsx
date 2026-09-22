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
    const scratch = useMemo(
        () => ({
            transform: new Object3D(),
            origin: new Vector3(),
            frustum: new Frustum(),
            matrix: new Matrix4(),
            sphere: new Sphere(new Vector3(), 2.5),
        }),
        [],
    );
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
            for (const { source, leaves } of descriptors) {
                source.object.getWorldPosition(scratch.origin);
                scratch.sphere.center.copy(scratch.origin);
                if (
                    !source.object.visible ||
                    (!(camera instanceof OrthographicCamera) &&
                        camera.position.distanceToSquared(scratch.origin) >
                            900) ||
                    !scratch.frustum.intersectsSphere(scratch.sphere)
                )
                    continue;
                for (
                    let index = 0;
                    index < Math.min(perTree, leaves.length);
                    index++
                ) {
                    const leaf = leaves[index];
                    if (active >= capacity) break;
                    const sample = sampleAutumnLeaf(
                        leaf.motion,
                        time.value,
                        windSpeed,
                        windDirection,
                    );
                    scratch.transform.position.set(
                        scratch.origin.x + sample.x,
                        scratch.origin.y - 0.5 + sample.y,
                        scratch.origin.z + sample.z,
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
                if (active >= capacity) break;
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
