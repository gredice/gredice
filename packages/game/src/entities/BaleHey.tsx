import { animated } from '@react-spring/three';
import { useEffect } from 'react';
import { ParticleType, useParticles } from '../particles/ParticleSystem';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

export function BaleHey({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes, materials } = useGameGLTF();
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);
    const { spawn } = useParticles();
    useEffect(() => {
        spawn(
            ParticleType.Hay,
            stack.position.clone().setY(currentStackHeight),
        );
    }, [spawn, currentStackHeight, stack.position]);

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight)}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.BaleHey.geometry}
                material={materials['Material.ColorPaletteMain']}
            />
        </animated.group>
    );
}
