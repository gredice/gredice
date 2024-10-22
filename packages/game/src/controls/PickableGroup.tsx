'use client';

import { Vector3, Plane, Raycaster, Vector2 } from 'three';
import { useThree } from '@react-three/fiber';
import { PointerEvent, PropsWithChildren, useEffect, useMemo, useRef } from 'react';
import { Handler, useDrag } from '@use-gesture/react';
import { useSpring, animated } from '@react-spring/three';
import { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { getStack } from '../utils/getStack';
import { stackHeight } from '../utils/getStackHeight';

const groundPlane = new Plane(new Vector3(0, 1, 0), 0);

type PickableGroupProps = PropsWithChildren<
    Pick<EntityInstanceProps, 'stack' | 'block'> &
    { onPositionChanged: (movement: Vector3) => void }>;

export function PickableGroup({ children, stack, block, onPositionChanged }: PickableGroupProps) {
    const [springs, api] = useSpring(() => ({
        from: { internalPosition: [0, 0, 0] },
        config: {
            mass: 0.1,
            tension: 200,
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

    // Reset position animation when block is moved
    useEffect(() => {
        api.set({ internalPosition: [0, 0, 0] });
    }, [stack.position]);

    const dragHandler: Handler<"drag", any> = ({ pressed, event, xy: [x, y] }) => {
        event.stopPropagation();

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

        if (!pressed) {
            if (!didDrag.current) {
                return;
            }
            didDrag.current = false;
            api.start({ internalPosition: [relative.x, hoveredStackHeight, relative.z] })[0].then(() => {
                onPositionChanged(relative);
            });
        } else {
            didDrag.current = true;
            api.start({ internalPosition: [relative.x, hoveredStackHeight + 0.1, relative.z] });
        }
    };

    const bind = useDrag(dragHandler, {
        filterTaps: true
    });

    function customBind() {
        const bindProps = bind();
        return {
            ...bindProps,
            onPointerDown: (event: PointerEvent) => {
                event.stopPropagation();
                bindProps.onPointerDown?.(event);
            }
        };
    }

    return (
        <animated.group
            position={springs.internalPosition as unknown as [number, number, number]}
            {...customBind() as any}>
            {children}
        </animated.group>
    )
}
