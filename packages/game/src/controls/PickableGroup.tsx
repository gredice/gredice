'use client';

import { Vector3, Plane, Raycaster, Vector2 } from 'three';
import { useThree } from '@react-three/fiber';
import { PointerEvent, PropsWithChildren, useEffect, useMemo, useRef, useState } from 'react';
import { Handler, useDrag } from '@use-gesture/react';
import { useSpring, animated } from '@react-spring/three';
import { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { getBlockDataByName, useStackHeight } from '../utils/getStackHeight';
import { useGameState } from '../useGameState';
import { Shadow } from '@react-three/drei';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import { useBlockData } from '../hooks/useBlockData';

const groundPlane = new Plane(new Vector3(0, 1, 0), 0);

type PickableGroupProps = PropsWithChildren<
    Pick<EntityInstanceProps, 'stack' | 'block'> &
    { onPositionChanged: (movement: Vector3) => void, noControl?: boolean }>;

export function PickableGroup({ children, stack, block, noControl, onPositionChanged }: PickableGroupProps) {
    const [dragSprings, dragSpringsApi] = useSpring(() => ({
        from: { internalPosition: [0, 0, 0] },
        config: {
            mass: 0.1,
            tension: 200,
            friction: 10
        }
    }));
    const { data: garden } = useCurrentGarden();
    const { data: blockData } = useBlockData();
    const getStack = ({ x, z }: { x: number, z: number }) => {
        return garden?.stacks.find(stack => stack.position.x === x && stack.position.z === z);
    };
    const camera = useThree(state => state.camera);
    const gl = useThree(state => state.gl);
    const { domElement } = gl;
    const dragState = useRef(({
        pt: new Vector3(),
        dest: new Vector3(),
        relative: new Vector3()
    }));
    const currentStackHeight = useStackHeight(stack, block);
    const didDrag = useRef(false);

    const effectsAudioMixer = useGameState((state) => state.audio.effects);
    const pickupSound = effectsAudioMixer.useSoundEffect('https://cdn.gredice.com/sounds/effects/Pick Grass 01.mp3');
    const dropSound = effectsAudioMixer.useSoundEffect(
        block.name === 'Block_Grass'
            ? 'https://cdn.gredice.com/sounds/effects/Drop Grass 01.mp3'
            : 'https://cdn.gredice.com/sounds/effects/Drop Grass 01.mp3'
    );

    const [isBlocked, setIsBlocked] = useState<boolean | null>(null);

    // Reset position animation when block is moved
    useEffect(() => {
        dragSpringsApi.set({ internalPosition: [0, 0, 0] });
        setIsBlocked(null);
    }, [stack.position]);

    if (noControl) {
        return <>{children}</>;
    }

    const isDraggingWorld = useGameState(state => state.isDragging);
    useEffect(() => {
        if (isDraggingWorld) {
            dragSpringsApi.start({ internalPosition: [0, 0, 0] });
            setIsBlocked(null);
        }
    }, [isDraggingWorld]);

    const rect = domElement.getClientRects()[0];

    const dragHandler: Handler<"drag", any> = ({ pressed, event, xy: [x, y] }) => {
        if (isDraggingWorld) {
            return;
        }

        event.stopPropagation();

        const { pt, dest, relative } = dragState.current;
        pt.set(
            ((x - rect.left) / rect.width) * 2 - 1,
            ((rect.top - y) / rect.height) * 2 + 1,
            0
        );

        const raycaster = new Raycaster()
        raycaster.setFromCamera(new Vector2(pt.x, pt.y), camera)
        const isIntersecting = raycaster.ray.intersectPlane(groundPlane, pt);
        if (!isIntersecting) {
            return;
        }

        dest.set(pt.x, 0, pt.z).round();
        relative.set(dest.x - stack.position.x, 0, dest.z - stack.position.z);

        const hoveredStack = getStack(dest);
        const hoveredStackHeight = hoveredStack === stack
            ? 0
            : currentStackHeight
        // TODO: Use hovered stack height to determine the height of the block
        // : stackHeight(hoveredStack) - (currentStackHeight ?? 0);

        // Check if under current hovered stack is stackable and mark as blocked or not
        const lastBlock = hoveredStack?.position === stack.position
            ? null
            : hoveredStack?.blocks.at(-1);
        const lastBlockDataBlocked = lastBlock
            ? !(getBlockDataByName(blockData, lastBlock.name)?.attributes.stackable ?? false)
            : false;
        if (lastBlockDataBlocked !== isBlocked && isBlocked !== null) {
            setIsBlocked(lastBlockDataBlocked);
        }

        if (!pressed) {
            if (!didDrag.current) {
                return;
            }
            didDrag.current = false;
            setIsBlocked(null);

            if (isBlocked) {
                // Revert to start position if released above blocked stack
                dragSpringsApi.start({ internalPosition: [0, 0, 0] });
            } else {
                dragSpringsApi.start({ internalPosition: [relative.x, hoveredStackHeight, relative.z] })[0].then(() => {
                    onPositionChanged(relative);
                });
                dropSound.play();
            }
        } else {
            if (!didDrag.current) {
                pickupSound.play();
                if (lastBlockDataBlocked !== isBlocked) {
                    setIsBlocked(lastBlockDataBlocked);
                }
            }
            didDrag.current = true;
            dragSpringsApi.start({ internalPosition: [relative.x, hoveredStackHeight + 0.1, relative.z] });
        }
    };

    const bindProps = useDrag(dragHandler, {
        filterTaps: true,
        enabled: !isDraggingWorld
    })();

    const customBindProps = {
        ...bindProps,
        onPointerDown: (event: PointerEvent) => {
            event.stopPropagation();
            bindProps.onPointerDown?.(event);
        }
    };

    // Handle blocking drop when stack is not stackable
    const blockedScaleSprings = useSpring({
        scale: isBlocked ? 1 : 0,
        opacity: isBlocked ? 1 : 0,
        config: {
            tension: 350,
        }
    });
    const blockedPosition = [stack.position.x, currentStackHeight, stack.position.z];

    return (
        <animated.group
            position={dragSprings.internalPosition as unknown as [number, number, number]}
            {...customBindProps}>
            <animated.group scale={blockedScaleSprings.scale} position={blockedPosition}>
                <Shadow
                    color={0xff0000}
                    opacity={1}
                    colorStop={0.5}
                    scale={2}
                />
            </animated.group>
            {children}
        </animated.group>
    )
}
