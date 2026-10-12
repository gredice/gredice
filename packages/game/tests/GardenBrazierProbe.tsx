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
import { useGameGLTF } from '../src/utils/useGameGLTF';

export function GardenBrazierProbe({
    onReady,
    weather,
}: {
    onReady: (value: string) => void;
    weather: string;
}) {
    const { scene, camera, size } = useThree();
    const { nodes, materials } = useGameGLTF('GardenBrazier');
    const emberMaterial = materials['Material.GardenBrazier.Embers'];
    const reported = useRef(false);
    useSceneTimeInvalidation('test:garden-brazier-ready', !reported.current);
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
        const clusters = ['brazier'].map((id) => {
            const root = scene.getObjectByName(`GardenBrazier:${id}`);
            const mesh = root?.getObjectByName('GardenBrazier_Metal');
            const embers = root?.getObjectByName('GardenBrazier_Embers');
            if (
                !root ||
                !(embers instanceof Mesh) ||
                !(embers.material instanceof MeshStandardMaterial) ||
                !(mesh instanceof Mesh) ||
                !(mesh.material instanceof MeshStandardMaterial)
            )
                throw new Error('Missing garden brazier geometry/material');
            const bounds = new Box3().setFromObject(root);
            // The interior charcoal is a stable real-geometry ray target in every rotation.
            const point = root
                .localToWorld(new Vector3(0, 0.35, 0))
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
                emberIntensity: embers.material.emissiveIntensity,
                ownsEmberMaterial: embers.material.uuid !== emberMaterial.uuid,
                sharesEmberGeometry:
                    embers.geometry === nodes.GardenBrazier_Embers.geometry,
                sourceEmissive: emberMaterial.emissive.getHex(),

                vertexColors: mesh.material.vertexColors,
                colorCount: mesh.geometry.getAttribute('color')?.count,
                triangles:
                    (mesh.geometry.index?.count ??
                        mesh.geometry.getAttribute('position').count) /
                        3 +
                    (embers.geometry.index?.count ??
                        embers.geometry.getAttribute('position').count) /
                        3,
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
        reported.current = true;
        onReady(JSON.stringify({ cropMeshes, clusters, neighbors }));
    });
    return null;
}
