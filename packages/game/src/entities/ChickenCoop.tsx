import { animated } from '@react-spring/three';
import type { GLTFResult } from '../models/GameAssets';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';
import { WaterSurfaceMaterial } from './helpers/WaterSurfaceMaterial';
import { WeatheredEntityPart } from './helpers/WeatheredEntityPart';

type ChickenCoopNodeName = Extract<
    keyof GLTFResult['nodes'],
    `ChickenCoop_${string}`
>;

const chickenCoopScale = 0.78;

const weatheredNodeNames = [
    'ChickenCoop_WoodDark',
    'ChickenCoop_WoodLight',
    'ChickenCoop_Roof',
    'ChickenCoop_Trim',
] satisfies ChickenCoopNodeName[];

const detailNodeNames = [
    'ChickenCoop_Entrance',
    'ChickenCoop_Straw',
    'ChickenCoop_Bowl',
] satisfies ChickenCoopNodeName[];

export function ChickenCoop({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes } = useGameGLTF('ChickenCoop');
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight)}
            rotation={animatedRotation as unknown as [number, number, number]}
            scale={chickenCoopScale}
        >
            {weatheredNodeNames.map((nodeName) => (
                <WeatheredEntityPart
                    key={nodeName}
                    node={nodes[nodeName]}
                    material={nodes[nodeName].material}
                    rain={{
                        darkness: 0.68,
                        glossiness: 0.46,
                        topSurfaceBias: 2.5,
                    }}
                    snow={{
                        coverageMultiplier:
                            nodeName === 'ChickenCoop_Roof' ? 1 : 0.58,
                        maxThickness:
                            nodeName === 'ChickenCoop_Roof' ? 0.09 : 0.045,
                        noiseScale: 3.1,
                        slopeExponent: 2.7,
                    }}
                />
            ))}
            {detailNodeNames.map((nodeName) => (
                <WeatheredEntityPart
                    key={nodeName}
                    node={nodes[nodeName]}
                    material={nodes[nodeName].material}
                    rain={{
                        darkness: 0.72,
                        glossiness: 0.38,
                        topSurfaceBias: 2.8,
                    }}
                    snow={{
                        coverageMultiplier: 0.25,
                        maxThickness: 0.025,
                        noiseScale: 3.5,
                        slopeExponent: 3.2,
                    }}
                />
            ))}
            <mesh
                geometry={nodes.ChickenCoop_Water.geometry}
                position={nodes.ChickenCoop_Water.position}
                rotation={nodes.ChickenCoop_Water.rotation}
                scale={nodes.ChickenCoop_Water.scale}
            >
                <WaterSurfaceMaterial />
            </mesh>
        </animated.group>
    );
}
