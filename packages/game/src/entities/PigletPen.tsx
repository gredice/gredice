import { animated } from '@react-spring/three';
import type { GLTFResult } from '../models/GameAssets';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';
import { WeatheredEntityPart } from './helpers/WeatheredEntityPart';

type PigletPenNodeName = Extract<
    keyof GLTFResult['nodes'],
    `PigletPen_${string}`
>;

const pigletPenScale = 0.91;

const weatheredNodeNames = [
    'PigletPen_Wood',
    'PigletPen_Wattle',
    'PigletPen_Limewash',
    'PigletPen_Roof',
    'PigletPen_Stone',
] satisfies PigletPenNodeName[];

const detailNodeNames = [
    'PigletPen_Mud',
    'PigletPen_Straw',
    'PigletPen_Trough',
] satisfies PigletPenNodeName[];

export function PigletPen({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes } = useGameGLTF('PigletPen');
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight)}
            rotation={animatedRotation as unknown as [number, number, number]}
            scale={pigletPenScale}
        >
            {weatheredNodeNames.map((nodeName) => (
                <WeatheredEntityPart
                    key={nodeName}
                    node={nodes[nodeName]}
                    material={nodes[nodeName].material}
                    rain={{
                        darkness: 0.65,
                        glossiness: 0.44,
                        topSurfaceBias: 2.4,
                    }}
                    snow={{
                        coverageMultiplier:
                            nodeName === 'PigletPen_Roof' ? 1 : 0.55,
                        maxThickness:
                            nodeName === 'PigletPen_Roof' ? 0.085 : 0.04,
                        noiseScale: 3.2,
                        slopeExponent: 2.8,
                    }}
                />
            ))}
            {detailNodeNames.map((nodeName) => (
                <WeatheredEntityPart
                    key={nodeName}
                    node={nodes[nodeName]}
                    material={nodes[nodeName].material}
                    rain={{
                        darkness: nodeName === 'PigletPen_Mud' ? 0.35 : 0.68,
                        glossiness: nodeName === 'PigletPen_Mud' ? 0.82 : 0.42,
                        topSurfaceBias: 2.7,
                    }}
                    snow={{
                        coverageMultiplier:
                            nodeName === 'PigletPen_Mud' ? 0.18 : 0.28,
                        maxThickness: 0.022,
                        noiseScale: 3.6,
                        slopeExponent: 3.1,
                    }}
                />
            ))}
        </animated.group>
    );
}
