import { RainWetOverlay } from '../rain/RainWetOverlay';
import { animated } from '../scene/sceneSpring';
import { SnowOverlay } from '../snow/SnowOverlay';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

const roseNodeNames = [
    'Rose_Stems',
    'Rose_Leaves',
    'Rose_Petals_Outer',
    'Rose_Petals_Inner',
    'Rose_Centers',
] as const;

export function Rose({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes } = useGameGLTF('Rose');
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const height = useStackHeight(stack, block);

    return (
        <animated.group
            name={`Rose:${block.id}`}
            position={stack.position.clone().setY(height)}
            rotation-y={animatedRotation?.to((_, y) => y)}
        >
            {roseNodeNames.map((nodeName) => {
                const node = nodes[nodeName];

                return (
                    <mesh
                        key={nodeName}
                        castShadow
                        receiveShadow
                        geometry={node.geometry}
                        material={node.material}
                        position={node.position}
                        rotation={node.rotation}
                        scale={node.scale}
                    >
                        <SnowOverlay
                            geometry={node.geometry}
                            maxThickness={0.012}
                            coverageMultiplier={0.25}
                        />
                        <RainWetOverlay
                            geometry={node.geometry}
                            glossiness={0.3}
                        />
                    </mesh>
                );
            })}
        </animated.group>
    );
}
