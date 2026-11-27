import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Mesh } from 'three';
import {
    useSceneFixedTimeSeconds,
    useSceneRenderRequest,
    useSceneTimeInvalidation,
} from '../src/scene/SceneTime';
import { useGameGLTF } from '../src/utils/useGameGLTF';
export function HedgehogRuntimeProbe({
    onReport,
}: {
    onReport: (value: string) => void;
}) {
    const { scene } = useThree();
    const gltf = useGameGLTF('Hedgehog');
    const disposed = useRef(0);
    const lastReport = useRef('');
    const fixed = useSceneFixedTimeSeconds();
    const requestRender = useSceneRenderRequest();
    // A live visit needs steady frames to report its progress. A frozen pose
    // lets the scene go idle instead: a permanent lease keeps software WebGL
    // rendering, and the queued frames delay every CI screenshot.
    useSceneTimeInvalidation('test:hedgehog-runtime', fixed === undefined, 15);
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
    // Report every frame: a throttled report can hold back the last frame
    // before a pause, and the next frame then publishes it as if the visit
    // had advanced while paused. The fixture writes it outside React.
    useFrame(() => {
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
        const report = JSON.stringify({
            actors,
            cachedDisposals: disposed.current,
            sourceHeadRotation: gltf.scene
                .getObjectByName('Hedgehog_HeadPivot')
                ?.rotation.toArray(),
        });
        if (report === lastReport.current) return;
        lastReport.current = report;
        onReport(report);
        // A frozen pose renders two more frames after each change, so work
        // that lands a frame later (the contact shadow batch) settles before
        // the scene goes idle.
        if (fixed !== undefined)
            requestRender('test:hedgehog-runtime-settle', 2);
    });
    return null;
}
