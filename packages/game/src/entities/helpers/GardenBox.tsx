import { animated, useSpring } from '@react-spring/three';
import { useDeferredSingleClick } from '../../controls/useDeferredSingleClick';
import { useHoveredBlockStore } from '../../controls/useHoveredBlockStore';
import { RainWetOverlay } from '../../rain/RainWetOverlay';
import { SnowOverlay } from '../../snow/SnowOverlay';
import { snowPresets } from '../../snow/snowPresets';
import type { EntityInstanceProps } from '../../types/runtime/EntityInstanceProps';
import { useGameState } from '../../useGameState';
import { useStackHeight } from '../../utils/getStackHeight';
import { useGameGLTF } from '../../utils/useGameGLTF';
import { HoverOutline } from './HoverOutline';
import { useAnimatedEntityRotation } from './useAnimatedEntityRotation';

const lidClosedRotation = 0;
const lidOpenRotation = -Math.PI / 2;

export function GardenBox({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes, materials } = useGameGLTF('GardenBox');
    const [animatedRotation] = useAnimatedEntityRotation(rotation + 2);
    const currentStackHeight = useStackHeight(stack, block);
    const hovered =
        useHoveredBlockStore((state) => state.hoveredBlock) === block;
    const activeDragPreview = useGameState((state) => state.activeDragPreview);
    const openGardenBoxBlockId = useGameState(
        (state) => state.openGardenBoxBlockId,
    );
    const setOpenGardenBoxBlockId = useGameState(
        (state) => state.setOpenGardenBoxBlockId,
    );
    const isLidOpen =
        activeDragPreview?.hoveredGardenBoxBlockId === block.id ||
        openGardenBoxBlockId === block.id;
    const { rotation: lidRotation } = useSpring({
        config: {
            mass: 0.18,
            tension: 260,
            friction: 18,
        },
        rotation: [isLidOpen ? lidOpenRotation : lidClosedRotation, 0, 0],
    });

    const handleClick = useDeferredSingleClick(() => {
        if (activeDragPreview) return;

        setOpenGardenBoxBlockId(block.id);
    });

    return (
        <HoverOutline
            hovered={hovered || isLidOpen}
            thickness={7}
            color="#f8fafc"
        >
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
                    position={[0, 0.6, -0.38]}
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
