import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useRef } from 'react';
import {
    Box3,
    Mesh,
    MeshStandardMaterial,
    ShaderMaterial,
    Vector3,
} from 'three';
import { useSceneTimeInvalidation } from '../src/scene/SceneTime';

export function HalloweenAccentsProbe({
    onReady,
    weather,
}: {
    onReady: (value: string) => void;
    weather: string;
}) {
    const { scene, camera, size } = useThree();
    const reported = useRef(false);
    useSceneTimeInvalidation('test:halloween-accents-ready', !reported.current);
    useLayoutEffect(() => {
        camera.lookAt(-0.4, 0.65, -0.4);
        camera.updateProjectionMatrix();
    }, [camera]);
    useFrame(() => {
        if (reported.current) return;
        let cropMeshes = 0;
        scene.getObjectByName('review-crops')?.traverse((node) => {
            if (node instanceof Mesh) cropMeshes++;
        });
        if (!cropMeshes) return;
        scene.updateMatrixWorld(true);
        const clusters = ['ghost', 'web'].map((id) => {
            const root = scene.getObjectByName(`HalloweenAccent:${id}`);
            const mesh = root?.getObjectByName(
                id === 'ghost'
                    ? 'FriendlyGhost_Arrangement'
                    : 'SupportedCobweb_Arrangement',
            );
            if (
                !root ||
                !(mesh instanceof Mesh) ||
                !(mesh.material instanceof MeshStandardMaterial)
            )
                throw new Error('Missing Halloween accent geometry/material');
            const bounds = new Box3().setFromObject(root);
            // Pick the sheet or the authored solid foot, never an invisible plane.
            const point = root
                .localToWorld(
                    id === 'ghost'
                        ? new Vector3(0, 0.6, 0)
                        : new Vector3(-0.085, 0.06, 0.085),
                )
                .project(camera);
            let snow = 0;
            let rain = 0;
            root.traverse((node) => {
                if (node.name === 'SnowOverlay') snow++;
                if (
                    node instanceof Mesh &&
                    node.material instanceof ShaderMaterial &&
                    'uWetness' in node.material.uniforms
                )
                    rain++;
            });
            return {
                id,
                rotation: root.rotation.y,
                minY: bounds.min.y,
                minX: bounds.min.x,
                maxX: bounds.max.x,
                minZ: bounds.min.z,
                maxZ: bounds.max.z,
                height: bounds.max.y - bounds.min.y,
                width: bounds.max.x - bounds.min.x,
                depth: bounds.max.z - bounds.min.z,
                materialId: mesh.material.uuid,
                vertexColors: mesh.material.vertexColors,
                colorCount: mesh.geometry.getAttribute('color')?.count,
                triangles:
                    (mesh.geometry.index?.count ??
                        mesh.geometry.getAttribute('position').count) / 3,
                snow,
                rain,
                x: ((point.x + 1) * size.width) / 2,
                y: ((1 - point.y) * size.height) / 2,
            };
        });
        if (weather === 'rain' && clusters.some((item) => !item.rain)) return;
        if (weather === 'snow' && clusters.some((item) => !item.snow)) return;
        const neighbors = [
            { id: 'lantern', name: 'review:lantern' },
            { id: 'bench', name: 'review:bench' },
        ].map(({ id, name }) => {
            const object = scene.getObjectByName(name);
            if (!object) throw new Error(`Missing neighbor ${name}`);
            const bounds = new Box3().setFromObject(object);
            const point = bounds
                .getCenter(new Vector3())
                .setY(bounds.max.y - 0.005)
                .project(camera);
            return {
                id,
                x: ((point.x + 1) * size.width) / 2,
                y: ((1 - point.y) * size.height) / 2,
            };
        });
        let batMeshes = 0;
        scene.getObjectByName('review-bats')?.traverseVisible((node) => {
            if (node instanceof Mesh) batMeshes++;
        });
        if (weather === 'night' && batMeshes === 0) return;
        reported.current = true;
        onReady(JSON.stringify({ cropMeshes, clusters, neighbors, batMeshes }));
    });
    return null;
}
