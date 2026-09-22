import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { DoubleSide, type Group, Mesh, MeshStandardMaterial } from 'three';
import type { AutumnLeafBatchData } from '../../scene/autumnAccumulation';
import { createAutumnLeafClusterGeometry } from '../../scene/autumnLeafClusterGeometry';
import { useGameState } from '../../useGameState';
import { EntityInstancesGeometry } from '../EntityInstancesBlock';

export function AutumnLeafBatch({
    batch,
    kind = 'ground',
}: {
    batch: AutumnLeafBatchData;
    kind?: 'ground' | 'entity';
}) {
    const group = useRef<Group>(null);
    const rain = useGameState(
        (state) => Math.round(state.rainSurfaceIntensity * 10) / 10,
    );
    const geometry = useMemo(
        () =>
            createAutumnLeafClusterGeometry(
                batch.gradientX,
                batch.gradientZ,
                batch.variant,
            ),
        [batch.gradientX, batch.gradientZ, batch.variant],
    );
    const material = useMemo(
        () =>
            new MeshStandardMaterial({
                vertexColors: true,
                side: DoubleSide,
                roughness: 0.9,
                polygonOffset: true,
                polygonOffsetFactor: -1,
                polygonOffsetUnits: -1,
            }),
        [],
    );
    useEffect(() => {
        material.roughness = 0.9 - rain * 0.4;
        material.color.setScalar(1 - rain * 0.2);
    }, [material, rain]);
    useEffect(() => () => geometry.dispose(), [geometry]);
    useEffect(() => () => material.dispose(), [material]);
    useLayoutEffect(() => {
        group.current?.traverse((object) => {
            if (object instanceof Mesh) object.raycast = () => {};
        });
    });
    return (
        <group ref={group}>
            <EntityInstancesGeometry
                instanceKey={`Autumn:${kind}:${batch.key}`}
                instances={batch.instances}
                geometry={geometry}
                material={material}
                renderSnow={false}
                castShadow={false}
                receiveShadow
                renderOrder={1}
            />
        </group>
    );
}
