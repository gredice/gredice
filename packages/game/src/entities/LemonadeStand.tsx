import { animated } from '@react-spring/three';
import { useMemo } from 'react';
import { Vector3 } from 'three';
import type { GLTFResult } from '../models/GameAssets';
import { RainWetOverlay } from '../rain/RainWetOverlay';
import { SnowOverlay } from '../snow/SnowOverlay';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

type LemonadeStandNode = GLTFResult['nodes'][keyof GLTFResult['nodes']];

const lemonadeStandScale = 0.45;

function getFootprintCenterOffset(rotation: number) {
    const normalizedRotation = ((Math.round(rotation) % 2) + 2) % 2;

    return normalizedRotation === 1
        ? new Vector3(0.5, 0, 1)
        : new Vector3(1, 0, 0.5);
}

function isLiquidNode(name: string) {
    return name.includes('_liquid');
}

function isGlassNode(name: string) {
    return name.includes('_glass');
}

function receivesWeatherOverlay(name: string) {
    const lowerName = name.toLowerCase();
    return (
        !isLiquidNode(lowerName) &&
        !isGlassNode(lowerName) &&
        !lowerName.includes('lemon') &&
        !lowerName.includes('leaf') &&
        !lowerName.includes('flower') &&
        !lowerName.includes('line') &&
        !lowerName.includes('cup')
    );
}

function LemonadeStandPart({
    name,
    node,
}: {
    name: string;
    node: LemonadeStandNode;
}) {
    const liquid = isLiquidNode(name);
    const glass = isGlassNode(name);
    const weathered = receivesWeatherOverlay(name);

    return (
        <mesh
            castShadow
            receiveShadow
            geometry={node.geometry}
            position={node.position}
            rotation={node.rotation}
            scale={node.scale}
            material={liquid || glass ? undefined : node.material}
        >
            {liquid && (
                <meshStandardMaterial
                    color="#f3cf45"
                    metalness={0}
                    roughness={0.48}
                    transparent
                    opacity={0.82}
                    depthWrite={false}
                />
            )}
            {glass && (
                <meshPhysicalMaterial
                    color="#f8fff2"
                    metalness={0}
                    roughness={0.08}
                    transparent
                    opacity={0.38}
                    depthWrite={false}
                />
            )}
            {weathered && (
                <>
                    <SnowOverlay
                        geometry={node.geometry}
                        maxThickness={0.06}
                        slopeExponent={2.7}
                        noiseScale={3.2}
                        coverageMultiplier={0.58}
                    />
                    <RainWetOverlay
                        geometry={node.geometry}
                        topSurfaceBias={2.2}
                        glossiness={0.7}
                    />
                </>
            )}
        </mesh>
    );
}

export function LemonadeStand({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes } = useGameGLTF('LemonadeStand');
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);
    const nodeEntries = useMemo(
        () =>
            Object.entries(nodes).filter(([name]) =>
                name.startsWith('LemonadeStand_'),
            ),
        [nodes],
    );
    const position = stack.position
        .clone()
        .add(getFootprintCenterOffset(rotation))
        .setY(currentStackHeight + 0.05);

    return (
        <animated.group
            position={position}
            rotation={animatedRotation as unknown as [number, number, number]}
            scale={lemonadeStandScale}
        >
            {nodeEntries.map(([name, node]) => (
                <LemonadeStandPart key={name} name={name} node={node} />
            ))}
        </animated.group>
    );
}
