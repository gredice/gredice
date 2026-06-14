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

type IceCreamCartNode = GLTFResult['nodes'][keyof GLTFResult['nodes']];

const iceCreamCartScale = 0.45;

function getFootprintCenterOffset(rotation: number) {
    const normalizedRotation = ((Math.round(rotation) % 2) + 2) % 2;

    return normalizedRotation === 1
        ? new Vector3(0.5, 0, 1)
        : new Vector3(1, 0, 0.5);
}

function receivesWeatherOverlay(name: string) {
    const lowerName = name.toLowerCase();
    return (
        !lowerName.includes('icecream') &&
        !lowerName.includes('scoop') &&
        !lowerName.includes('mint_chip') &&
        !lowerName.includes('waffle') &&
        !lowerName.includes('cone') &&
        !lowerName.includes('syrup') &&
        !lowerName.includes('takeaway') &&
        !lowerName.includes('menu_color_dot') &&
        !lowerName.includes('menu_line')
    );
}

function IceCreamCartPart({
    name,
    node,
}: {
    name: string;
    node: IceCreamCartNode;
}) {
    const weathered = receivesWeatherOverlay(name);

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
            {weathered && (
                <>
                    <SnowOverlay
                        geometry={node.geometry}
                        maxThickness={0.045}
                        slopeExponent={2.8}
                        noiseScale={3.1}
                        coverageMultiplier={0.52}
                    />
                    <RainWetOverlay
                        geometry={node.geometry}
                        topSurfaceBias={2.2}
                        glossiness={0.68}
                    />
                </>
            )}
        </mesh>
    );
}

export function IceCreamCart({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes } = useGameGLTF('IceCreamCart');
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);
    const nodeEntries = useMemo(
        () =>
            Object.entries(nodes).filter(([name]) =>
                name.startsWith('IceCreamCart_'),
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
            scale={iceCreamCartScale}
        >
            {nodeEntries.map(([name, node]) => (
                <IceCreamCartPart key={name} name={name} node={node} />
            ))}
        </animated.group>
    );
}
