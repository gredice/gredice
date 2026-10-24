import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useRef } from 'react';
import { Box3, Mesh, Raycaster, ShaderMaterial, Vector3 } from 'three';
import { useCurrentGarden } from '../src/hooks/useCurrentGarden';
import { useSceneTimeInvalidation } from '../src/scene/SceneTime';

export function AutumnEntrancesProbe({
    onReady,
    weather,
    storageKey,
}: {
    onReady: (value: string) => void;
    weather: string;
    storageKey: string;
}) {
    const { scene, camera, size } = useThree();
    const reported = useRef('');
    const { data: garden } = useCurrentGarden();
    useSceneTimeInvalidation('test:autumn-entrances-ready', true);
    useLayoutEffect(() => {
        camera.lookAt(-0.4, 0.65, -0.4);
        camera.updateProjectionMatrix();
    }, [camera]);
    useFrame(() => {
        let cropMeshes = 0;
        scene.getObjectByName('review-crops')?.traverse((node) => {
            if (node instanceof Mesh) cropMeshes++;
        });
        if (!cropMeshes) return;
        scene.updateMatrixWorld(true);
        const clusters = ['wreath', 'garland', 'gate'].map((id) => {
            const root = scene.getObjectByName(
                `${id === 'gate' ? 'FenceGate' : 'AutumnEntrance'}:${id}`,
            );
            if (!root) throw new Error(`Missing ${id}`);
            const bounds = new Box3().setFromObject(root);
            let triangles = 0,
                snow = 0,
                rain = 0;
            const materialIds = new Set<string>();
            root.traverse((node) => {
                if (node.name === 'SnowOverlay') snow++;
                if (node instanceof Mesh) {
                    if (node.material instanceof ShaderMaterial) {
                        if ('uWetness' in node.material.uniforms) rain++;
                        return;
                    }
                    triangles +=
                        (node.geometry.index?.count ??
                            node.geometry.getAttribute('position').count) / 3;
                    for (const material of Array.isArray(node.material)
                        ? node.material
                        : [node.material])
                        materialIds.add(material.uuid);
                }
            });
            const target =
                id === 'gate'
                    ? new Vector3(0.43, 0.53, 0)
                    : id === 'wreath'
                      ? new Vector3(0, 0.91, 0)
                      : new Vector3(-0.34, 0.89, 0);
            const world = root.localToWorld(target);
            const point = world.clone().project(camera);
            const direction = world.clone().sub(camera.position).normalize();
            const hits = new Raycaster(
                camera.position,
                direction,
            ).intersectObject(root, true);
            if (!hits.length)
                throw new Error(`No real geometry ray hit for ${id}`);
            let decorHits = 0;
            if (id === 'gate') {
                const decor = root.getObjectByName('AutumnFenceGate_Decor');
                if (!decor) throw new Error('Missing fixed pumpkins');
                const decorPoint = new Box3()
                    .setFromObject(decor)
                    .getCenter(new Vector3());
                decorHits = new Raycaster(
                    camera.position,
                    decorPoint.sub(camera.position).normalize(),
                ).intersectObject(decor, true).length;
            }
            return {
                id,
                rotation: root.rotation.y,
                minY: bounds.min.y,
                height: bounds.max.y - bounds.min.y,
                width: bounds.max.x - bounds.min.x,
                depth: bounds.max.z - bounds.min.z,
                triangles,
                materials: materialIds.size,
                snow,
                rain,
                decorHits,
                x: ((point.x + 1) * size.width) / 2,
                y: ((1 - point.y) * size.height) / 2,
            };
        });
        if (weather === 'rain' && clusters.some((c) => !c.rain)) return;
        if (weather === 'snow' && clusters.some((c) => !c.snow)) return;
        const leaf = scene.getObjectByName('FenceGate:leaf:gate');
        if (!leaf) return;
        const gate = garden?.stacks
            .flatMap((stack) => stack.blocks)
            .find((block) => block.id === 'gate');
        const value = JSON.stringify({
            cropMeshes,
            clusters,
            gateAngle: leaf.rotation.y,
            gateVariant: gate?.variant,
            storageKey,
        });
        if (value !== reported.current) {
            reported.current = value;
            onReady(value);
        }
    });
    return null;
}
