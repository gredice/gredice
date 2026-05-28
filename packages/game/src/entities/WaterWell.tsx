import { animated } from '@react-spring/three';
import type { ReactNode } from 'react';
import type { GLTFResult } from '../models/GameAssets';
import { RainWetOverlay } from '../rain/RainWetOverlay';
import { SnowOverlay } from '../snow/SnowOverlay';
import { snowPresets } from '../snow/snowPresets';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';
import { WaterSurfaceMaterial } from './helpers/WaterSurfaceMaterial';

type WaterWellNodeName = Extract<
    keyof GLTFResult['nodes'],
    `WaterWell_${string}`
>;
type WaterWellNode = GLTFResult['nodes'][WaterWellNodeName];

const stoneNodeNames = [
    'WaterWell_Stone_Mid',
    'WaterWell_Stone_Light',
    'WaterWell_Stone_Dark',
] satisfies WaterWellNodeName[];

const woodNodeNames = ['WaterWell_Wood_Frame'] satisfies WaterWellNodeName[];

const waterWellScale = 0.78;

function WaterWellPart({
    children,
    node,
}: {
    children?: ReactNode;
    node: WaterWellNode;
}) {
    return (
        <mesh
            castShadow
            receiveShadow
            geometry={node.geometry}
            material={node.material}
            position={node.position}
            rotation={node.rotation}
            scale={node.scale}
        >
            {children}
        </mesh>
    );
}

export function WaterWell({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes } = useGameGLTF('WaterWell');
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight)}
            rotation={animatedRotation as unknown as [number, number, number]}
            scale={waterWellScale}
        >
            {stoneNodeNames.map((nodeName) => {
                const node = nodes[nodeName];

                return (
                    <WaterWellPart key={nodeName} node={node}>
                        <SnowOverlay
                            geometry={node.geometry}
                            {...snowPresets.stone}
                        />
                        <RainWetOverlay
                            geometry={node.geometry}
                            topSurfaceBias={2.3}
                            glossiness={0.75}
                        />
                    </WaterWellPart>
                );
            })}
            {woodNodeNames.map((nodeName) => {
                const node = nodes[nodeName];

                return (
                    <WaterWellPart key={nodeName} node={node}>
                        <SnowOverlay
                            geometry={node.geometry}
                            maxThickness={0.08}
                            slopeExponent={2.8}
                            noiseScale={3.2}
                            coverageMultiplier={0.72}
                        />
                        <RainWetOverlay geometry={node.geometry} />
                    </WaterWellPart>
                );
            })}
            <WaterWellPart node={nodes.WaterWell_Rope}>
                <RainWetOverlay
                    geometry={nodes.WaterWell_Rope.geometry}
                    topSurfaceBias={3}
                    darkness={0.7}
                    glossiness={0.72}
                />
            </WaterWellPart>
            <mesh
                geometry={nodes.WaterWell_Water.geometry}
                position={nodes.WaterWell_Water.position}
                rotation={nodes.WaterWell_Water.rotation}
                scale={nodes.WaterWell_Water.scale}
            >
                <WaterSurfaceMaterial />
            </mesh>
        </animated.group>
    );
}
