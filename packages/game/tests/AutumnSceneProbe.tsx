import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useRef } from 'react';
import { Mesh, MeshStandardMaterial } from 'three';
import { useSceneTimeInvalidation } from '../src/scene/SceneTime';

export function AutumnSceneProbe({
    onReady,
}: {
    onReady: (value: string) => void;
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
        const canopies: string[] = [];
        scene.traverse((object) => {
            if (
                object.name.startsWith('Autumn:Canopy:') &&
                object instanceof Mesh &&
                object.material instanceof MeshStandardMaterial
            ) {
                canopies.push(
                    `${object.material.color.getHexString()}:${object.geometry.index?.count ?? object.geometry.attributes.position.count}`,
                );
            }
        });
        if (canopies.length === 3) onReady(canopies.join(','));
    });
    return null;
}
