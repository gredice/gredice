import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useRef } from 'react';
import {
    Box3,
    Mesh,
    MeshStandardMaterial,
    PointLight,
    ShaderMaterial,
    Vector3,
} from 'three';
import { useSceneTimeInvalidation } from '../src/scene/SceneTime';
export function PumpkinLanternsProbe({
    onReady,
    weather,
}: {
    onReady: (value: string) => void;
    weather: string;
}) {
    const { scene, camera, size } = useThree();
    const reported = useRef(false);
    useSceneTimeInvalidation('test:pumpkin-lanterns-ready', !reported.current);
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
        const clusters = ['smile', 'wink'].map((id) => {
            const root = scene.getObjectByName(`PumpkinLantern:${id}`);
            if (!root) throw Error('Missing pumpkin lantern');
            const model =
                id === 'smile' ? 'PumpkinLanternSmile' : 'PumpkinLanternWink';
            const glow = root.getObjectByName(`${model}_Glow`);
            const lamp = root.getObjectByName(`GardenLight:${model}:${id}`);
            if (
                !(glow instanceof Mesh) ||
                !(glow.material instanceof MeshStandardMaterial) ||
                !(lamp instanceof PointLight)
            )
                throw Error('Missing owned emissive surface/light');
            const bounds = new Box3().setFromObject(root);
            const point = root
                .localToWorld(new Vector3(0, 0.38, 0))
                .project(camera);
            let triangles = 0,
                snow = 0,
                rain = 0;
            root.traverse((node) => {
                if (node.name === 'SnowOverlay') snow++;
                if (node instanceof Mesh) {
                    if (
                        node.material instanceof ShaderMaterial &&
                        'uWetness' in node.material.uniforms
                    )
                        rain++;
                    if (
                        node.name === `${model}_Body` ||
                        node.name === `${model}_Stem` ||
                        node.name === `${model}_Glow`
                    )
                        triangles +=
                            (node.geometry.index?.count ??
                                node.geometry.getAttribute('position').count) /
                            3;
                }
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
                materialId: glow.material.uuid,
                triangles,
                snow,
                rain,
                emission: glow.material.emissiveIntensity,
                lightShadow: lamp.castShadow,
                x: ((point.x + 1) * size.width) / 2,
                y: ((1 - point.y) * size.height) / 2,
            };
        });
        if (
            weather === 'night' &&
            clusters.some((item) => item.emission <= 0.1)
        )
            return;
        if (weather === 'rain' && clusters.some((item) => !item.rain)) return;
        if (weather === 'snow' && clusters.some((item) => !item.snow)) return;
        const neighbors = [
            { id: 'lantern', name: 'review:lantern' },
            { id: 'bench', name: 'review:bench' },
        ].map(({ id, name }) => {
            const root = scene.getObjectByName(name);
            if (!root) throw Error('Missing neighbor');
            const bounds = new Box3().setFromObject(root);
            const p = bounds
                .getCenter(new Vector3())
                .setY(bounds.max.y - 0.005)
                .project(camera);
            return {
                id,
                x: ((p.x + 1) * size.width) / 2,
                y: ((1 - p.y) * size.height) / 2,
            };
        });
        let lights = 0,
            activeLights = 0,
            shadowLights = 0;
        scene.traverse((node) => {
            if (
                node instanceof PointLight &&
                node.name.startsWith('GardenLight:')
            ) {
                lights++;
                if (node.visible && node.intensity > 0) activeLights++;
                if (node.castShadow) shadowLights++;
            }
        });
        reported.current = true;
        onReady(
            JSON.stringify({
                cropMeshes,
                clusters,
                neighbors,
                lights,
                activeLights,
                shadowLights,
            }),
        );
    });
    return null;
}
