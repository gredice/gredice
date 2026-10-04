import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useRef, useState } from 'react';
import type { Group } from 'three';
import { useDeferredSingleClick } from '../../controls/useDeferredSingleClick';
import { useHoveredBlockStore } from '../../controls/useHoveredBlockStore';
import { RainWetOverlay } from '../../rain/RainWetOverlay';
import { useRegisterAutumnPart } from '../../scene/AutumnParts';
import { animated, useSpring } from '../../scene/sceneSpring';
import { SnowOverlay } from '../../snow/SnowOverlay';
import { snowPresets } from '../../snow/snowPresets';
import type { EntityInstanceProps } from '../../types/runtime/EntityInstanceProps';
import { useGameState } from '../../useGameState';
import { useStackHeight } from '../../utils/getStackHeight';
import { useGameGLTF } from '../../utils/useGameGLTF';
import { autumnPartLeafSurfaces } from './autumnLeafSurfaces';
import {
    gardenBoxLidHingePosition,
    gardenBoxOpenLidRotation,
    gardenBoxRootQuarterTurns,
} from './gardenBoxLidTransform';
import { HoverOutline } from './HoverOutline';
import { useAnimatedEntityRotation } from './useAnimatedEntityRotation';

const lidClosedRotation = 0;
const lidOpenRotation = gardenBoxOpenLidRotation[0];

export function GardenBox({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes, materials } = useGameGLTF('GardenBox');
    const [animatedRotation] = useAnimatedEntityRotation(
        rotation + gardenBoxRootQuarterTurns,
    );
    const currentStackHeight = useStackHeight(stack, block);
    const isLocalSandbox = useGameState(
        (state) => state.localSandboxStorageKey !== null,
    );
    const hovered =
        useHoveredBlockStore((state) => state.hoveredBlock) === block;
    const hoveredGardenBoxBlockId = useGameState(
        (state) => state.activeDragPreview?.hoveredGardenBoxBlockId ?? null,
    );
    const hasActiveDragPreview = useGameState((state) =>
        Boolean(state.activeDragPreview),
    );
    const openGardenBoxBlockId = useGameState(
        (state) => state.openGardenBoxBlockId,
    );
    const setOpenGardenBoxBlockId = useGameState(
        (state) => state.setOpenGardenBoxBlockId,
    );
    const isLidOpen =
        !isLocalSandbox &&
        (hoveredGardenBoxBlockId === block.id ||
            openGardenBoxBlockId === block.id);
    const lidRef = useRef<Group>(null);
    const isLidOpenRef = useRef(isLidOpen);
    isLidOpenRef.current = isLidOpen;
    const [lidSettled, setLidSettled] = useState(!isLidOpen);
    useLayoutEffect(() => {
        if (isLidOpen) setLidSettled(false);
    }, [isLidOpen]);
    useRegisterAutumnPart({
        blockId: block.id,
        partId: 'GardenBox_Lid_HingeOrigin',
        eligibilityPolicy: 'closed-and-settled',
        ref: lidRef,
        surfaces: autumnPartLeafSurfaces.GardenBox_Lid_HingeOrigin,
        eligible: !isLidOpen && lidSettled,
        covered: stack.blocks
            .slice(stack.blocks.indexOf(block) + 1)
            .some((above) => above.name.startsWith('Block_')),
    });
    const showHoverOutline =
        !isLocalSandbox && ((!hasActiveDragPreview && hovered) || isLidOpen);
    const { rotation: lidRotation } = useSpring({
        from: {
            rotation: [isLidOpen ? lidOpenRotation : lidClosedRotation, 0, 0],
        },
        config: {
            mass: 0.18,
            tension: 260,
            friction: 18,
        },
        rotation: [isLidOpen ? lidOpenRotation : lidClosedRotation, 0, 0],
        onRest: () => {
            if (!isLidOpenRef.current) setLidSettled(true);
        },
    });
    useFrame(() => {
        if (
            !isLidOpenRef.current &&
            !lidSettled &&
            lidRotation.idle &&
            Math.abs(lidRotation.get()[0]) < 0.001
        )
            setLidSettled(true);
    });

    const handleClick = useDeferredSingleClick(() => {
        if (isLocalSandbox || hasActiveDragPreview) return;

        setOpenGardenBoxBlockId(block.id);
    });

    return (
        <HoverOutline hovered={showHoverOutline} thickness={7} color="#f8fafc">
            <animated.group
                onClick={handleClick}
                position={stack.position.clone().setY(currentStackHeight)}
                rotation={
                    animatedRotation as unknown as [number, number, number]
                }
            >
                <mesh
                    castShadow
                    receiveShadow
                    geometry={nodes.GardenBox_Body_Planks.geometry}
                    material={materials['Material.Planks']}
                />
                <SnowOverlay
                    geometry={nodes.GardenBox_Body_Planks.geometry}
                    {...snowPresets.giftBox}
                />
                <RainWetOverlay
                    geometry={nodes.GardenBox_Body_Planks.geometry}
                />
                <animated.group
                    ref={lidRef}
                    name="GardenBox_Lid_HingeOrigin"
                    position={gardenBoxLidHingePosition}
                    rotation={
                        lidRotation as unknown as [number, number, number]
                    }
                >
                    <mesh
                        receiveShadow
                        geometry={nodes.GardenBox_Lid_HingeOrigin.geometry}
                        material={materials['Material.Planks']}
                    />
                    <SnowOverlay
                        geometry={nodes.GardenBox_Lid_HingeOrigin.geometry}
                        {...snowPresets.giftBox}
                    />
                    <RainWetOverlay
                        geometry={nodes.GardenBox_Lid_HingeOrigin.geometry}
                    />
                </animated.group>
            </animated.group>
        </HoverOutline>
    );
}
