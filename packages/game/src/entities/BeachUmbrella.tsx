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

type BeachUmbrellaNodeName = Extract<
    keyof GLTFResult['nodes'],
    `BeachUmbrella_${string}`
>;
type BeachUmbrellaNode = GLTFResult['nodes'][BeachUmbrellaNodeName];

const canopyNodeNames = [
    'BeachUmbrella_CanopyMesh',
    'BeachUmbrella_CanopyMesh_1',
    'BeachUmbrella_CanopyMesh_2',
    'BeachUmbrella_CanopyMesh_3',
] satisfies BeachUmbrellaNodeName[];

const supportNodeNames = [
    'BeachUmbrella_Pole',
    'BeachUmbrella_Stake',
    'BeachUmbrella_CanopyTrim',
    'BeachUmbrella_Ribs',
] satisfies BeachUmbrellaNodeName[];

const beachUmbrellaScale = 1.08;

function BeachUmbrellaPart({
    children,
    node,
}: {
    children?: ReactNode;
    node: BeachUmbrellaNode;
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

export function BeachUmbrella({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes } = useGameGLTF('BeachUmbrella');
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight)}
            rotation={animatedRotation as unknown as [number, number, number]}
            scale={beachUmbrellaScale}
        >
            {canopyNodeNames.map((nodeName) => {
                const node = nodes[nodeName];

                return (
                    <BeachUmbrellaPart key={nodeName} node={node}>
                        <SnowOverlay
                            geometry={node.geometry}
                            maxThickness={0.06}
                            slopeExponent={2.6}
                            noiseScale={3.1}
                            coverageMultiplier={0.68}
                        />
                        <RainWetOverlay
                            geometry={node.geometry}
                            topSurfaceBias={2.8}
                            glossiness={0.82}
                        />
                    </BeachUmbrellaPart>
                );
            })}
            {supportNodeNames.map((nodeName) => {
                const node = nodes[nodeName];

                return (
                    <BeachUmbrellaPart key={nodeName} node={node}>
                        <SnowOverlay
                            geometry={node.geometry}
                            {...snowPresets.tool}
                        />
                        <RainWetOverlay
                            geometry={node.geometry}
                            topSurfaceBias={3}
                            darkness={0.78}
                            glossiness={0.84}
                        />
                    </BeachUmbrellaPart>
                );
            })}
        </animated.group>
    );
}
