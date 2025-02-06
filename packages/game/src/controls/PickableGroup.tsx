'use client';

import { Vector3, Plane, Raycaster, Vector2 } from 'three';
import { useThree } from '@react-three/fiber';
import { PointerEvent, PropsWithChildren, useEffect, useMemo, useRef, useState } from 'react';
import { Handler, useDrag } from '@use-gesture/react';
import { useSpring, animated } from '@react-spring/three';
import { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { getStack } from '../utils/getStack';
import { getBlockDataByName, stackHeight } from '../utils/getStackHeight';
import { useGameState } from '../useGameState';
import { Shadow } from '@react-three/drei';

const groundPlane = new Plane(new Vector3(0, 1, 0), 0);

type PickableGroupProps = PropsWithChildren<
    Pick<EntityInstanceProps, 'stack' | 'block'> &
    { onPositionChanged: (movement: Vector3) => void, noControl?: boolean }>;

export function PickableGroup({ children, stack, block, noControl, onPositionChanged }: PickableGroupProps) {
    const [springs, api] = useSpring(() => ({
        from: { internalPosition: [0, 0, 0] },
        config: {
            mass: 0.1,
            tension: 100,
            friction: 10
        }
    }));
    const camera = useThree(state => state.camera);
    const domElement = useThree(state => state.gl.domElement);
    const dragState = useMemo(() => ({
        pt: new Vector3(),
        dest: new Vector3(),
        relative: new Vector3()
    }), []);
    const currentStackHeight = useMemo(() => stackHeight(stack, block), [stack, block]);
    const didDrag = useRef(false);

    const effectsAudioMixer = useGameState((state) => state.audio.effects);
    const pickupSound = effectsAudioMixer.useSoundEffect('/assets/sounds/effects/Pick Grass 01.mp3');
    const dropSound = effectsAudioMixer.useSoundEffect(
        block.name === 'Block_Grass'
            ? '/assets/sounds/effects/Drop Grass 01.mp3'
            : '/assets/sounds/effects/Drop Grass 01.mp3'
    );

    const [isBlocked, setIsBlocked] = useState(false);

    // Reset position animation when block is moved
    useEffect(() => {
        api.set({ internalPosition: [0, 0, 0] });
        setIsBlocked(false);
    }, [stack.position]);

    if (noControl) {
        return <>{children}</>;
    }

    const isDraggingWorld = useGameState(state => state.isDragging);
    useEffect(() => {
        if (isDraggingWorld) {
            api.start({ internalPosition: [0, 0, 0] });
            setIsBlocked(false);
        }
    }, [isDraggingWorld]);

    const dragHandler: Handler<"drag", any> = ({ pressed, event, xy: [x, y] }) => {
        event.stopPropagation();

        if (isDraggingWorld) {
            return;
        }

        const rect = domElement.getClientRects()[0];
        const { pt, dest, relative } = dragState;
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

        dest.set(pt.x, 0, pt.z).ceil();
        relative.set(dest.x - stack.position.x, 0, dest.z - stack.position.z);

        const hoveredStack = getStack(dest);
        const hoveredStackHeight = hoveredStack === stack
            ? 0
            : stackHeight(hoveredStack) - currentStackHeight;

        // Check if under current hovered stack is stackable and mark as blocked or not
        const lastBlock = hoveredStack?.position === stack.position
            ? null
            : hoveredStack?.blocks.at(-1);
        const lastBlockDataBlocked = lastBlock
            ? !(getBlockDataByName(lastBlock.name)?.attributes.stackable ?? false)
            : false;
        if (lastBlockDataBlocked !== isBlocked) {
            setIsBlocked(lastBlockDataBlocked);
        }

        if (!pressed) {
            if (!didDrag.current) {
                return;
            }
            didDrag.current = false;

            if (isBlocked) {
                // Revert to start position if released above blocked stack
                api.start({ internalPosition: [0, 0, 0] });
                setIsBlocked(false);
            } else {
                api.start({ internalPosition: [relative.x, hoveredStackHeight, relative.z] })[0].then(() => {
                    onPositionChanged(relative);
                    setIsBlocked(false);
                });
                dropSound.play();
            }
        } else {
            if (!didDrag.current) {
                pickupSound.play();
            }
            didDrag.current = true;
            api.start({ internalPosition: [relative.x, hoveredStackHeight + 0.1, relative.z] });
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
        },

    });
    const blockedPosition = [stack.position.x, stackHeight(stack, block), stack.position.z];

    return (
        /* @ts-ignore */
        <animated.group
            position={springs.internalPosition as unknown as [number, number, number]}
            {...customBindProps}>
            {/* @ts-ignore */}
            <animated.group scale={blockedScaleSprings.scale} position={blockedPosition}>
                <Shadow
                    color={0xff0907}
                    opacity={0.8}
                    colorStop={0.2}
                    scale={2}
                />
                {/* @ts-ignore */}
            </animated.group>
            {children}
            {/* @ts-ignore */}
        </animated.group>
    )
}
