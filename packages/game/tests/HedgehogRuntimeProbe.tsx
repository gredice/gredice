import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Mesh } from 'three';
import { useSceneTimeInvalidation } from '../src/scene/SceneTime';
import { useGameGLTF } from '../src/utils/useGameGLTF';
export function HedgehogRuntimeProbe({
    onReport,
}: {
    onReport: (value: string) => void;
}) {
    const { scene } = useThree();
    const gltf = useGameGLTF('Hedgehog');
    const last = useRef(0);
    const disposed = useRef(0);
    useSceneTimeInvalidation('test:hedgehog-runtime', true, 15);
    useEffect(() => {
        const listener = () => disposed.current++;
        const geometries = new Set(
            Object.values(gltf.nodes)
                .filter((n) => n instanceof Mesh)
                .map((n) => n.geometry),
        );
        for (const g of geometries) g.addEventListener('dispose', listener);
        return () => {
            for (const g of geometries)
                g.removeEventListener('dispose', listener);
        };
    }, [gltf.nodes]);
    useFrame(() => {
        if (performance.now() - last.current < 70) return;
        last.current = performance.now();
        const actors: {
            name: string;
            position: number[];
            clip: unknown;
            elapsed: unknown;
            sequence: unknown;
            meshes: number;
            triangles: number;
            shadowCasters: number;
            pickable: number;
        }[] = [];
        scene.traverse((node) => {
            if (!node.name.startsWith('Hedgehog:')) return;
            let meshes = 0,
                triangles = 0,
                shadowCasters = 0,
                pickable = 0;
            node.traverse((child) => {
                if (child instanceof Mesh) {
                    meshes++;
                    triangles +=
                        (child.geometry.index?.count ??
                            child.geometry.getAttribute('position').count) / 3;
                    if (child.castShadow) shadowCasters++;
                    if (child.raycast === Mesh.prototype.raycast) pickable++;
                }
            });
            actors.push({
                name: node.name,
                position: node.position.toArray(),
                clip: node.userData.clip,
                elapsed: node.userData.elapsed,
                sequence: node.userData.sequence,
                meshes,
                triangles,
                shadowCasters,
                pickable,
            });
        });
        onReport(
            JSON.stringify({
                actors,
                cachedDisposals: disposed.current,
                sourceHeadRotation: gltf.scene
                    .getObjectByName('Hedgehog_HeadPivot')
                    ?.rotation.toArray(),
            }),
        );
    });
    return null;
}
