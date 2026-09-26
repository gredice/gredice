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

export function HedgehogShelterProbe({
    onReady,
    weather,
    closeUp = false,
}: {
    onReady: (value: string) => void;
    weather: string;
    closeUp?: boolean;
}) {
    const { scene, camera, size } = useThree();
    const reported = useRef(false);
    useSceneTimeInvalidation('test:hedgehog-shelter-ready', !reported.current);
    useLayoutEffect(() => {
        if (closeUp) camera.lookAt(-1, 0.55, -2);
        else camera.lookAt(-0.4, 0.65, -0.4);
        camera.updateProjectionMatrix();
    }, [camera, closeUp]);
    useFrame(() => {
        if (reported.current) return;
        let cropMeshes = 0;
        scene.getObjectByName('review-crops')?.traverse((node) => {
            if (node instanceof Mesh) cropMeshes++;
        });
        if (!cropMeshes) return;
        scene.updateMatrixWorld(true);
        const clusters = ['shelter'].map((id) => {
            const root = scene.getObjectByName(`HedgehogShelter:${id}`);
            const mesh = root?.getObjectByName('HedgehogShelter_Arrangement');
            if (
                !root ||
                !(mesh instanceof Mesh) ||
                !(mesh.material instanceof MeshStandardMaterial)
            )
                throw new Error('Missing bird feeder geometry/material');
            const bounds = new Box3().setFromObject(root);
            // The solid centre of the shallow tray is a stable real-geometry ray target in every rotation.
            const point = root
                .localToWorld(new Vector3(0, 0.46, 0))
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
        let actorCount = 0,
            actorTriangles = 0,
            actorMeshes = 0,
            actorShadowCasters = 0;
        const actorPositions: number[][] = [];
        scene.traverse((node) => {
            if (node.name.startsWith('Hedgehog:')) {
                actorCount++;
                actorPositions.push(node.position.toArray());
                node.traverse((child) => {
                    if (child instanceof Mesh) {
                        actorMeshes++;
                        actorTriangles +=
                            (child.geometry.index?.count ??
                                child.geometry.getAttribute('position').count) /
                            3;
                        if (child.castShadow) actorShadowCasters++;
                    }
                });
            }
        });
        reported.current = true;
        onReady(
            JSON.stringify({
                cropMeshes,
                clusters,
                neighbors,
                actorCount,
                actorTriangles,
                actorMeshes,
                actorShadowCasters,
                actorPositions,
            }),
        );
    });
    return null;
}
