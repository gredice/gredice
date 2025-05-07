'use client';

import { Vector3, Plane, Raycaster, Vector2 } from 'three';
import { useThree } from '@react-three/fiber';
import { PointerEvent, PropsWithChildren, useEffect, useMemo, useRef, useState } from 'react';
import { Handler, useDrag } from '@use-gesture/react';
import { useSpring, animated } from '@react-spring/three';
import { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { getBlockDataByName, useStackHeight } from '../utils/getStackHeight';
import { useGameState } from '../useGameState';
import { Html, Shadow } from '@react-three/drei';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import { useBlockData } from '../hooks/useBlockData';
import { useBlockMove } from '../hooks/useBlockMove';
import { cx } from '@signalco/ui-primitives/cx';

type Direction = "up" | "right" | "down" | "left"

interface MoveIndicatorProps {
    activeDirection?: Direction
    onDirectionChange?: (direction: Direction) => void
    size?: "sm" | "md" | "lg"
    className?: string
}

export function MoveIndicator({
    onDirectionChange: onMove,
    className,
}: MoveIndicatorProps) {
    const handleDirectionClick = (newDirection: Direction) => {
        onMove?.(newDirection)
    }

    return (
        <div className={cx("relative pointer-events-none", 'w-32 h-32', className)}>
            {/* Center dot */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-green-500 rounded-full"></div>

            {/* Up Arrow */}
            <button
                className={cx(
                    "absolute w-8 h-12 left-1/2 -translate-x-1/2 top-1 transform -translate-y-1/4 transition-all duration-200",
                    "opacity-80 hover:opacity-100",
                )}
                onClick={() => handleDirectionClick("up")}
                aria-label="Move up"
            >
                <svg viewBox="0 0 40 60" className="w-full h-full">
                    <polygon
                        points="20,0 40,30 30,30 30,60 10,60 10,30 0,30"
                        className={cx(
                            "transition-colors duration-200",
                            "fill-slate-600 stroke-slate-500 stroke-1 hover:fill-slate-500",
                        )}
                    />
                </svg>
            </button>

            {/* Right Arrow */}
            <button
                className={cx(
                    "absolute w-12 h-8 right-1 top-1/2 -translate-y-1/2 transform translate-x-1/4 transition-all duration-200",
                    "opacity-80 hover:opacity-100",
                )}
                onClick={() => handleDirectionClick("right")}
                aria-label="Move right"
            >
                <svg viewBox="0 0 60 40" className="w-full h-full">
                    <polygon
                        points="60,20 30,40 30,30 0,30 0,10 30,10 30,0"
                        className={cx(
                            "transition-colors duration-200",
                            "fill-slate-600 stroke-slate-500 stroke-1 hover:fill-slate-500",
                        )}
                    />
                </svg>
            </button>

            {/* Down Arrow */}
            <button
                className={cx(
                    "absolute w-8 h-12 left-1/2 -translate-x-1/2 bottom-1 transform translate-y-1/4 transition-all duration-200",
                    "opacity-80 hover:opacity-100",
                )}
                onClick={() => handleDirectionClick("down")}
                aria-label="Move down"
            >
                <svg viewBox="0 0 40 60" className="w-full h-full">
                    <polygon
                        points="20,60 0,30 10,30 10,0 30,0 30,30 40,30"
                        className={cx(
                            "transition-colors duration-200",
                            "fill-slate-600 stroke-slate-500 stroke-1 hover:fill-slate-500",
                        )}
                    />
                </svg>
            </button>

            {/* Left Arrow */}
            <button
                className={cx(
                    "absolute w-12 h-8 left-1 top-1/2 -translate-y-1/2 transform -translate-x-1/4 transition-all duration-200",
                    "opacity-80 hover:opacity-100",
                )}
                onClick={() => handleDirectionClick("left")}
                aria-label="Move left"
            >
                <svg viewBox="0 0 60 40" className="w-full h-full">
                    <polygon
                        points="0,20 30,0 30,10 60,10 60,30 30,30 30,40"
                        className={cx(
                            "transition-colors duration-200",
                            "fill-slate-600 stroke-slate-500 stroke-1 hover:fill-slate-500",
                        )}
                    />
                </svg>
            </button>
        </div>
    )
}


const groundPlane = new Plane(new Vector3(0, 1, 0), 0);

type PickableGroupProps = PropsWithChildren<Pick<EntityInstanceProps, 'stack' | 'block'>>;

export function PickableGroup({ children, stack, block }: PickableGroupProps) {
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
    const currentBlockData = blockData?.find(data => data.information.name === block.name);
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

    const setMovingBlock = useGameState(state => state.setMovingBlock);

    const effectsAudioMixer = useGameState((state) => state.audio.effects);
    const pickupSound = effectsAudioMixer.useSoundEffect('https://cdn.gredice.com/sounds/effects/Pick Grass 01.mp3');
    const dropSound = effectsAudioMixer.useSoundEffect(
        block.name === 'Block_Grass'
            ? 'https://cdn.gredice.com/sounds/effects/Drop Grass 01.mp3'
            : 'https://cdn.gredice.com/sounds/effects/Drop Grass 01.mp3'
    );

    // Blocked is feature where the block is not stackable and the block is above it
    const [isBlocked, setIsBlocked] = useState<boolean | null>(null);
    const moveBlock = useBlockMove();

    // Reset position animation when block is moved
    useEffect(() => {
        dragSpringsApi.set({ internalPosition: [0, 0, 0] });
        setIsBlocked(null);
    }, [stack.position]);

    const isDraggingWorld = useGameState(state => state.isDragging);
    useEffect(() => {
        if (isDraggingWorld) {
            dragSpringsApi.start({ internalPosition: [0, 0, 0] });
            setIsBlocked(null);
        }
    }, [isDraggingWorld]);

    const rect = domElement.getClientRects()[0];

    const dragHandler: Handler<"drag", any> = async ({ pressed, event, xy: [x, y] }) => {
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
                dragSpringsApi.start({ internalPosition: [relative.x, hoveredStackHeight, relative.z] });
                dropSound.play();
                await moveBlock.mutateAsync({
                    sourcePosition: stack.position,
                    destinationPosition: stack.position.clone().add(relative),
                    blockIndex: stack.blocks.indexOf(block)
                });
            }

            setMovingBlock(null);
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
    const blockedPosition: [number, number, number] = [stack.position.x, currentStackHeight, stack.position.z];

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
            <group position={[
                stack.position.x,
                (currentBlockData?.attributes.height ?? 0),
                stack.position.z
            ]}>
                <Html center>
                    <div
                        style={{
                            transform: 'rotateX(60deg) rotateZ(45deg)',
                        }}>
                        <MoveIndicator />
                    </div>
                </Html>
            </group>
        </animated.group>
    )
}
