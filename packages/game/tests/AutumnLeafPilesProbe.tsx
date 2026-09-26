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

export function AutumnLeafPilesProbe({
    onReady,
    weather,
    requireAmbient,
}: {
    onReady: (value: string) => void;
    weather: string;
    requireAmbient: boolean;
}) {
    const { scene, camera, size } = useThree();
    const reported = useRef(false);
    useSceneTimeInvalidation('test:leaf-piles-ready', !reported.current);
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
        const clusters = ['pile-mound', 'pile-crescent'].map((id) => {
            const root = scene.getObjectByName(`AutumnLeafPile:${id}`);
            const mesh = root?.getObjectByName(
                id === 'pile-mound'
                    ? 'AutumnLeafPileMound_Leaves'
                    : 'AutumnLeafPileCrescent_Leaves',
            );
            if (
                !root ||
                !(mesh instanceof Mesh) ||
                !(mesh.material instanceof MeshStandardMaterial)
            )
                throw new Error('Missing leaf pile geometry/material');
            const bounds = new Box3().setFromObject(root);
            const anchor = root.getObjectByName(
                `AutumnLeafPile:rake-anchor:${id}`,
            );
            if (!anchor) throw new Error('Missing stable activity anchor');
            const anchorPosition = anchor.getWorldPosition(new Vector3());
            const point = anchorPosition.clone().project(camera);
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
                height: bounds.max.y - bounds.min.y,
                width: bounds.max.x - bounds.min.x,
                depth: bounds.max.z - bounds.min.z,
                materialId: mesh.material.uuid,
                anchor: anchor.position.toArray(),
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
        let ambientLeaves = 0;
        scene.traverse((node) => {
            if (node.name.includes('Autumn:ground:')) ambientLeaves++;
        });
        if (requireAmbient && !ambientLeaves) return;
        reported.current = true;
        onReady(JSON.stringify({ cropMeshes, clusters, ambientLeaves }));
    });
    return null;
}
