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

export function AutumnBlanketBenchProbe({
    onReady,
    weather,
}: {
    onReady: (value: string) => void;
    weather: string;
}) {
    const { scene, camera, size } = useThree();
    const reported = useRef(false);
    useSceneTimeInvalidation(
        'test:autumn-blanket-bench-ready',
        !reported.current,
    );
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
        const clusters = ['bench'].map((id) => {
            const root = scene.getObjectByName(`AutumnBlanketBench:${id}`);
            const mesh = root?.getObjectByName('AutumnBlanketBench_Timber');
            if (
                !root ||
                !(mesh instanceof Mesh) ||
                !(mesh.material instanceof MeshStandardMaterial)
            )
                throw new Error('Missing blanket bench geometry/material');
            const bounds = new Box3().setFromObject(root);
            // The upper barrel is a stable real-geometry ray target in every rotation.
            const point = root
                .localToWorld(new Vector3(0.2, 0.415, 0))
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
                triangles: [
                    mesh,
                    root.getObjectByName('AutumnBlanketBench_Textile'),
                ].reduce(
                    (sum, node) =>
                        sum +
                        (node instanceof Mesh
                            ? (node.geometry.index?.count ??
                                  node.geometry.getAttribute('position')
                                      .count) / 3
                            : 0),
                    0,
                ),
                snow,
                rain,
                x: ((point.x + 1) * size.width) / 2,
                y: ((1 - point.y) * size.height) / 2,
            };
        });
        if (weather === 'rain' && clusters.some((item) => !item.rain)) return;
        if (weather === 'snow' && clusters.some((item) => !item.snow)) return;
        const neighbors = [
            { id: 'mushrooms', name: 'WoodlandMushrooms:mushrooms' },
            { id: 'legacy-bench', name: 'review:legacy-bench' },
        ].map(({ id, name }) => {
            const object = scene.getObjectByName(name);
            if (!object) throw new Error(`Missing neighbor ${name}`);
            const neighborBounds = new Box3().setFromObject(object);
            const point = (
                id === 'mushrooms'
                    ? object.localToWorld(new Vector3(-0.094, 0.38, -0.015))
                    : neighborBounds
                          .getCenter(new Vector3())
                          .setY(neighborBounds.max.y - 0.012)
            ).project(camera);
            return {
                id,
                x: ((point.x + 1) * size.width) / 2,
                y: ((1 - point.y) * size.height) / 2,
            };
        });
        reported.current = true;
        onReady(JSON.stringify({ cropMeshes, clusters, neighbors }));
    });
    return null;
}
