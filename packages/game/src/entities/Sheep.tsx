import { animated } from '@react-spring/three';
import { useMemo } from 'react';
import type { Mesh } from 'three';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

export const sheepModelScale = 0.46;

export function Sheep({ stack, block, rotation }: EntityInstanceProps) {
    const gltf = useGameGLTF('Sheep');
    const currentStackHeight = useStackHeight(stack, block);
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const model = useMemo(() => {
        const clone = gltf.scene.clone(true);
        clone.traverse((object) => {
            if ('isMesh' in object && object.isMesh) {
                const mesh = object as Mesh;
                mesh.castShadow = false;
                mesh.receiveShadow = true;
            }
        });
        return clone.getObjectByName('Sheep_Root') ?? clone;
    }, [gltf.scene]);

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight + 0.025)}
            rotation={animatedRotation as unknown as [number, number, number]}
            scale={sheepModelScale}
        >
            <primitive object={model} />
        </animated.group>
    );
}
