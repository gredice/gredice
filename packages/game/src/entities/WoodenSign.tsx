import { animated } from '@react-spring/three';
import type { GLTFResult } from '../models/GameAssets';
import { RainWetOverlay } from '../rain/RainWetOverlay';
import { SnowOverlay } from '../snow/SnowOverlay';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';
import { WoodenSignText } from './WoodenSignText';

type WoodenSignNodeName = Extract<
    keyof GLTFResult['nodes'],
    `WoodenSign_${string}`
>;

const woodenSignNodeNames = [
    'WoodenSign_Post',
    'WoodenSign_Board',
    'WoodenSign_Frame',
    'WoodenSign_Fasteners',
] satisfies WoodenSignNodeName[];

export function WoodenSign({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes } = useGameGLTF('WoodenSign');
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight)}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            {woodenSignNodeNames.map((nodeName) => {
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
                            maxThickness={
                                nodeName === 'WoodenSign_Board' ? 0.04 : 0.025
                            }
                            slopeExponent={3.4}
                            noiseScale={3.8}
                            coverageMultiplier={
                                nodeName === 'WoodenSign_Board' ? 0.5 : 0.28
                            }
                        />
                        <RainWetOverlay
                            geometry={node.geometry}
                            topSurfaceBias={2.7}
                            darkness={0.78}
                            glossiness={0.55}
                        />
                    </mesh>
                );
            })}
            <WoodenSignText message={block.message ?? ''} />
        </animated.group>
    );
}
