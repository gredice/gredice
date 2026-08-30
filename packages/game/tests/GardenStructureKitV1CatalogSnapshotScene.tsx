'use client';

import { useThree } from '@react-three/fiber';
import { type ReactNode, useEffect, useMemo } from 'react';
import { type Material, Mesh } from 'three';
import type { GardenStructureCatalogEntry } from '../src/structures/catalog/gardenStructureKitV1Catalog';
import {
    GardenStructureKitV1AssetBoundary,
    GardenStructureKitV1LoadedInstances,
} from '../src/structures/GardenStructureKitV1AssetRenderer';
import { useGameGLTF } from '../src/utils/useGameGLTF';
import { createGardenStructureKitV1CatalogSnapshot } from './gardenStructureKitV1CatalogSnapshot';

function renderNoFallback(): ReactNode {
    return null;
}

function isMaterial(value: Material | undefined): value is Material {
    return value !== undefined;
}

export function GardenStructureKitV1CatalogSnapshotScene({
    entry,
    onReady,
}: Readonly<{
    entry: GardenStructureCatalogEntry;
    onReady: () => void;
}>) {
    const camera = useThree((state) => state.camera);
    const invalidate = useThree((state) => state.invalidate);
    const gltf = useGameGLTF('GardenStructureKitV1');
    const snapshot = useMemo(
        () => createGardenStructureKitV1CatalogSnapshot(entry),
        [entry],
    );
    const materialsByName = useMemo(() => {
        const materials = new Map<string, Material>();
        gltf.scene.traverse((object) => {
            if (!(object instanceof Mesh)) {
                return;
            }
            const meshMaterials = Array.isArray(object.material)
                ? object.material
                : [object.material];
            for (const material of meshMaterials) {
                if (material.name) {
                    materials.set(material.name, material);
                }
            }
        });
        return materials;
    }, [gltf.scene]);
    const swatchMaterials = snapshot.materialNames
        .map((name) => materialsByName.get(name))
        .filter(isMaterial);

    if (swatchMaterials.length !== snapshot.materialNames.length) {
        throw new Error(`Could not resolve every material for ${entry.key}.`);
    }

    useEffect(() => {
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();
        invalidate();
    }, [camera, invalidate]);

    useEffect(() => {
        let secondFrame = 0;
        const firstFrame = window.requestAnimationFrame(() => {
            invalidate();
            secondFrame = window.requestAnimationFrame(() => {
                invalidate();
                onReady();
            });
        });
        return () => {
            window.cancelAnimationFrame(firstFrame);
            window.cancelAnimationFrame(secondFrame);
        };
    }, [invalidate, onReady]);

    const groundSize = Math.max(
        snapshot.extent.width,
        snapshot.extent.depth,
        1.5,
    );
    const swatchWidth =
        swatchMaterials.length === 0 ? 0 : 1.08 / swatchMaterials.length;

    return (
        <>
            <color args={['#edf4e6']} attach="background" />
            <ambientLight intensity={1.65} />
            <directionalLight intensity={2.1} position={[4, 7, 5]} />
            <directionalLight intensity={0.65} position={[-4, 3, -2]} />
            <group
                position={[
                    -snapshot.center.x,
                    -snapshot.center.height,
                    -snapshot.center.z,
                ]}
            >
                <mesh
                    position={[snapshot.center.x, -0.015, snapshot.center.z]}
                    receiveShadow
                    rotation={[-Math.PI / 2, 0, 0]}
                >
                    <planeGeometry
                        args={[groundSize * 1.9, groundSize * 1.9]}
                    />
                    <meshStandardMaterial color="#d9e8cf" roughness={0.95} />
                </mesh>
                {snapshot.footprintGuideCells.map((cell) => (
                    <mesh
                        key={`${cell.x.toString()}:${cell.z.toString()}`}
                        position={[cell.x, 0.025, cell.z]}
                    >
                        <boxGeometry args={[0.92, 0.05, 0.92]} />
                        <meshStandardMaterial
                            color="#8bad72"
                            opacity={0.78}
                            transparent
                        />
                    </mesh>
                ))}
                {swatchMaterials.map((material, index) => (
                    <mesh
                        key={material.name}
                        material={material}
                        position={[
                            snapshot.center.x -
                                0.54 +
                                swatchWidth * (index + 0.5),
                            0.08,
                            snapshot.center.z,
                        ]}
                    >
                        <boxGeometry args={[swatchWidth, 0.16, 0.78]} />
                    </mesh>
                ))}
                {snapshot.batches.length > 0 ? (
                    <GardenStructureKitV1AssetBoundary fallback={null}>
                        <GardenStructureKitV1LoadedInstances
                            baseHeight={0}
                            batches={snapshot.batches}
                            castShadows={false}
                            namePrefix="GardenStructureKitV1CatalogSnapshot"
                            renderFallback={renderNoFallback}
                            selectedInstanceId={null}
                        />
                    </GardenStructureKitV1AssetBoundary>
                ) : null}
            </group>
        </>
    );
}
