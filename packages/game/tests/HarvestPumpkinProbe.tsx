import { harvestPumpkins } from '@gredice/js/harvestPumpkins';
import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useRef } from 'react';
import { Box3, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { useSceneTimeInvalidation } from '../src/scene/SceneTime';

export function HarvestPumpkinProbe({
    onReady,
}: {
    onReady: (data: string) => void;
}) {
    const { scene, camera, size } = useThree();
    const frames = useRef(0);
    useLayoutEffect(() => {
        camera.lookAt(0, 0.4, 0);
        camera.updateProjectionMatrix();
    }, [camera]);
    useSceneTimeInvalidation('test:harvest-pumpkins-ready', frames.current < 8);
    useFrame(() => {
        if (++frames.current !== 8) return;
        scene.updateMatrixWorld(true);
        const items = harvestPumpkins.map((item) => {
            const object = scene.getObjectByName(`HarvestPumpkin:${item.name}`);
            if (!object) throw new Error(`Missing runtime model: ${item.name}`);
            const body = object.children.find(
                (child) =>
                    child instanceof Mesh &&
                    child.material instanceof MeshStandardMaterial &&
                    child.material.color.getHexString().toLowerCase() ===
                        item.color.slice(1).toLowerCase(),
            );
            if (!body) throw new Error(`Wrong runtime colour: ${item.name}`);
            const bounds = new Box3().setFromObject(object);
            const point = new Box3()
                .setFromObject(body)
                .getCenter(new Vector3())
                .project(camera);
            return {
                name: item.name,
                rotationY: object.rotation.y,
                minY: bounds.min.y,
                height: bounds.max.y - bounds.min.y,
                x: ((point.x + 1) * size.width) / 2,
                y: ((1 - point.y) * size.height) / 2,
            };
        });
        onReady(JSON.stringify(items));
    });
    return null;
}
