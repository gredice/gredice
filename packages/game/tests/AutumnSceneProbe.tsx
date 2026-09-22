import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useRef } from 'react';
import { InstancedMesh, Mesh, MeshStandardMaterial } from 'three';
import { useSceneTimeInvalidation } from '../src/scene/SceneTime';

export function AutumnSceneProbe({
    onReady,
    onLeafCount,
    onGroundCount,
}: {
    onReady: (value: string) => void;
    onGroundCount?: (count: number) => void;
    onLeafCount?: (count: number) => void;
}) {
    const camera = useThree((state) => state.camera);
    const scene = useThree((state) => state.scene);
    const frames = useRef(0);
    useSceneTimeInvalidation('test:autumn-ready', frames.current < 5);
    useLayoutEffect(() => {
        camera.lookAt(0, 0.8, 0);
        camera.updateProjectionMatrix();
    }, [camera]);
    useFrame(() => {
        if (++frames.current < 5) return;
        const leaves = scene.getObjectByName('Weather:AutumnLeaves');
        if (leaves instanceof InstancedMesh) onLeafCount?.(leaves.count);
        const canopies: string[] = [];
        let groundCount = 0;
        scene.traverse((object) => {
            if (
                object.name.startsWith('BlockInstances:Autumn:ground:') &&
                object instanceof InstancedMesh
            )
                groundCount += object.count;
            if (
                (object.name.startsWith('Autumn:Canopy:') ||
                    object.name.startsWith('BlockInstances:Tree:canopy:')) &&
                object instanceof Mesh &&
                object.material instanceof MeshStandardMaterial
            ) {
                for (
                    let index = 0;
                    index <
                    (object instanceof InstancedMesh ? object.count : 1);
                    index++
                )
                    canopies.push(
                        `${object.material.color.getHexString()}:${object.geometry.index?.count ?? object.geometry.attributes.position.count}`,
                    );
            }
        });
        onGroundCount?.(groundCount);
        if (canopies.length === 3) onReady(canopies.join(','));
    });
    return null;
}
