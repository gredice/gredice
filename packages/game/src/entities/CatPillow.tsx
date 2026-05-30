import { animated } from '@react-spring/three';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

const pillowTopColor = '#d85f72';
const pillowSideColor = '#a84657';
const pillowSeamColor = '#f0a6b2';

export function CatPillow({ stack, block, rotation }: EntityInstanceProps) {
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight + 0.18)}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            <mesh castShadow receiveShadow scale={[0.5, 0.16, 0.38]}>
                <sphereGeometry args={[1, 24, 12]} />
                <meshStandardMaterial
                    color={pillowSideColor}
                    roughness={0.82}
                />
            </mesh>
            <mesh
                castShadow
                receiveShadow
                position={[0, 0.055, 0]}
                scale={[0.42, 0.09, 0.3]}
            >
                <sphereGeometry args={[1, 24, 10]} />
                <meshStandardMaterial color={pillowTopColor} roughness={0.86} />
            </mesh>
            <mesh position={[0, 0.17, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.39, 0.008, 8, 48]} />
                <meshStandardMaterial color={pillowSeamColor} roughness={0.9} />
            </mesh>
        </animated.group>
    );
}
