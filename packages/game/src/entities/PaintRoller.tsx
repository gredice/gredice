import { animated } from '@react-spring/three';
import type { ThreeEvent } from '@react-three/fiber';
import { type ReactNode, useState } from 'react';
import { useCycleGardenBackgroundPalette } from '../hooks/useCycleGardenBackgroundPalette';
import type { GLTFResult } from '../models/GameAssets';
import { RainWetOverlay } from '../rain/RainWetOverlay';
import { SnowOverlay } from '../snow/SnowOverlay';
import { snowPresets } from '../snow/snowPresets';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { HoverOutline } from './helpers/HoverOutline';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

type PaintRollerNodeName = Extract<
    keyof GLTFResult['nodes'],
    `PaintRoller_${string}`
>;
type PaintRollerNode = GLTFResult['nodes'][PaintRollerNodeName];

const allNodeNames = [
    'PaintRoller_Sleeve',
    'PaintRoller_Sleeve_Shadow',
    'PaintRoller_EndCap_Left',
    'PaintRoller_EndCap_Right',
    'PaintRoller_EndHub',
    'PaintRoller_Frame',
    'PaintRoller_Handle',
    'PaintRoller_Handle_Collar_Top',
    'PaintRoller_Handle_Collar_Bottom',
] satisfies PaintRollerNodeName[];

const overlayNodeNames = new Set<PaintRollerNodeName>([
    'PaintRoller_Sleeve',
    'PaintRoller_EndCap_Left',
    'PaintRoller_EndCap_Right',
    'PaintRoller_EndHub',
    'PaintRoller_Frame',
    'PaintRoller_Handle',
    'PaintRoller_Handle_Collar_Top',
    'PaintRoller_Handle_Collar_Bottom',
]);

const paintRollerScale = 0.44;

function PaintRollerPart({
    children,
    node,
}: {
    children?: ReactNode;
    node: PaintRollerNode;
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

export function PaintRoller({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes } = useGameGLTF('PaintRoller');
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);
    const cycleBackgroundPalette = useCycleGardenBackgroundPalette();
    const [hovered, setHovered] = useState(false);

    function handleClick(event: ThreeEvent<MouseEvent>) {
        event.stopPropagation();
        cycleBackgroundPalette();
    }

    function handlePointerEnter(event: ThreeEvent<PointerEvent>) {
        event.stopPropagation();
        setHovered(true);
    }

    function handlePointerLeave(event: ThreeEvent<PointerEvent>) {
        event.stopPropagation();
        setHovered(false);
    }

    return (
        <HoverOutline color="white" hovered={hovered} thickness={7}>
            <animated.group
                onClick={handleClick}
                onPointerEnter={handlePointerEnter}
                onPointerLeave={handlePointerLeave}
                position={stack.position.clone().setY(currentStackHeight)}
                rotation={
                    animatedRotation as unknown as [number, number, number]
                }
                scale={paintRollerScale}
            >
                {allNodeNames.map((nodeName) => {
                    const node = nodes[nodeName];
                    const withWeatherOverlays = overlayNodeNames.has(nodeName);

                    return (
                        <PaintRollerPart key={nodeName} node={node}>
                            {withWeatherOverlays && (
                                <>
                                    <SnowOverlay
                                        geometry={node.geometry}
                                        {...snowPresets.tool}
                                    />
                                    <RainWetOverlay
                                        geometry={node.geometry}
                                        topSurfaceBias={2.6}
                                        darkness={0.78}
                                        glossiness={0.88}
                                    />
                                </>
                            )}
                        </PaintRollerPart>
                    );
                })}
            </animated.group>
        </HoverOutline>
    );
}
