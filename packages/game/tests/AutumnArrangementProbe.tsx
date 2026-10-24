import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useRef } from 'react';
import { Box3, Mesh, Vector3 } from 'three';
import type { AutumnArrangement } from '../src/arrangements/autumnArrangements';
import { useSceneTimeInvalidation } from '../src/scene/SceneTime';

export function AutumnArrangementProbe({
    arrangement,
    onReady,
}: {
    arrangement: AutumnArrangement;
    onReady: (value: string) => void;
}) {
    const { scene, camera, size } = useThree();
    const frames = useRef(0);
    const reported = useRef(false);
    useSceneTimeInvalidation('test:autumn-arrangement', !reported.current);
    useLayoutEffect(() => {
        camera.lookAt(-0.5, 0.8, -0.5);
        camera.updateProjectionMatrix();
    }, [camera]);
    useFrame(() => {
        // Stars use Math.random even with fixed scene time. Omit only that
        // background point field in this isolated composition capture.
        scene.traverse((object) => {
            if (object.name.startsWith('Environment:Stars:'))
                object.visible = false;
        });
        if (reported.current || ++frames.current < 8) return;
        scene.updateMatrixWorld(true);
        const objects = arrangement.placements.map((placement) => {
            const object = scene.getObjectByName(`arrangement:${placement.id}`);
            if (!object)
                throw new Error(`Missing pictured item ${placement.id}`);
            let meshes = 0;
            object.traverse((child) => {
                if (child instanceof Mesh) meshes++;
            });
            if (!meshes) throw new Error(`Missing geometry ${placement.id}`);
            const bounds = new Box3().setFromObject(object);
            const screen = [];
            for (const x of [bounds.min.x, bounds.max.x])
                for (const y of [bounds.min.y, bounds.max.y])
                    for (const z of [bounds.min.z, bounds.max.z]) {
                        const point = new Vector3(x, y, z).project(camera);
                        screen.push({
                            x: ((point.x + 1) * size.width) / 2,
                            y: ((1 - point.y) * size.height) / 2,
                        });
                    }
            return {
                id: placement.id,
                entityName: placement.entityName,
                role: placement.role,
                meshes,
                min: bounds.min.toArray(),
                max: bounds.max.toArray(),
                screen: {
                    minX: Math.min(...screen.map((point) => point.x)),
                    maxX: Math.max(...screen.map((point) => point.x)),
                    minY: Math.min(...screen.map((point) => point.y)),
                    maxY: Math.max(...screen.map((point) => point.y)),
                },
            };
        });
        reported.current = true;
        onReady(JSON.stringify(objects));
    });
    return null;
}
