import { animated } from '@react-spring/three';
import { useEffect } from 'react';
import { ParticleType, useParticles } from '../particles/ParticleSystem';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

export function StoneLarge({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes, materials } = useGameGLTF();
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);
    const { spawn } = useParticles();

    useEffect(() => {
        spawn(
            ParticleType.Stone,
            stack.position.clone().setY(currentStackHeight),
            10,
        );
    }, [spawn, stack.position, currentStackHeight]);

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight)}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.Stone_Large.geometry}
                material={materials['Material.Stone']}
                scale={[0.263, 0.426, 0.291]}
            />
        </animated.group>
    );
}
