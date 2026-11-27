import type { ReactNode } from 'react';
import { DoubleSide } from 'three';
import type { GLTFResult } from '../models/GameAssets';
import { RainWetOverlay } from '../rain/RainWetOverlay';
import { animated } from '../scene/sceneSpring';
import { seasonalRoles } from '../scene/seasonalRoles';
import { SnowOverlay } from '../snow/SnowOverlay';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

type CatPillowNodeName = Extract<
    keyof GLTFResult['nodes'],
    `CatPillow_${string}`
>;
type CatPillowNode = GLTFResult['nodes'][CatPillowNodeName];

const catPillowScale = 0.62;

// Linear albedo in sRGB hex: the scene lights a sunlit face to about 3.2
// times its albedo, so the cushion shows coral red #ee5048 and the piping the
// cream role #f2e4c6 (assets/scripts/party-pass-props.py). Matte fabric.
export const catPillowFabricMaterial = {
    color: '#953632',
    metalness: 0,
    roughness: 0.8,
    side: DoubleSide,
};

export const catPillowSeamMaterial = {
    color: seasonalRoles.cream.albedo,
    metalness: 0,
    roughness: seasonalRoles.cream.roughness,
    side: DoubleSide,
};

function CatPillowPart({
    castShadow = true,
    children,
    node,
    receiveShadow = true,
}: {
    castShadow?: boolean;
    children: ReactNode;
    node: CatPillowNode;
    receiveShadow?: boolean;
}) {
    return (
        <mesh
            castShadow={castShadow}
            geometry={node.geometry}
            position={node.position}
            receiveShadow={receiveShadow}
            rotation={node.rotation}
            scale={node.scale}
        >
            {children}
        </mesh>
    );
}

function WeatheredCatPillowPart({
    children,
    node,
    snowMaxThickness = 0.035,
    snowCoverageMultiplier = 0.55,
}: {
    children: ReactNode;
    node: CatPillowNode;
    snowMaxThickness?: number;
    snowCoverageMultiplier?: number;
}) {
    return (
        <CatPillowPart node={node}>
            {children}
            <SnowOverlay
                geometry={node.geometry}
                maxThickness={snowMaxThickness}
                slopeExponent={2.4}
                noiseScale={3.2}
                coverageMultiplier={snowCoverageMultiplier}
            />
            <RainWetOverlay
                geometry={node.geometry}
                topSurfaceBias={2.2}
                darkness={0.68}
                glossiness={0.42}
            />
        </CatPillowPart>
    );
}

export function CatPillow({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes } = useGameGLTF('CatPillow');
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight)}
            rotation={animatedRotation as unknown as [number, number, number]}
            scale={catPillowScale}
        >
            <WeatheredCatPillowPart
                node={nodes.CatPillow_Cushion}
                snowMaxThickness={0.045}
                snowCoverageMultiplier={0.5}
            >
                <meshStandardMaterial {...catPillowFabricMaterial} />
            </WeatheredCatPillowPart>
            <WeatheredCatPillowPart
                node={nodes.CatPillow_Seam}
                snowMaxThickness={0.025}
                snowCoverageMultiplier={0.42}
            >
                <meshStandardMaterial {...catPillowSeamMaterial} />
            </WeatheredCatPillowPart>
        </animated.group>
    );
}
