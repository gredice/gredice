import { ThreeEvent } from "@react-three/fiber";
import { PropsWithChildren, useRef } from "react";
import type { Block } from "../types/Block";
import type { Stack } from "../types/Stack";
import { useGameState } from "../useGameState";

export function RotatableGroup({ children, stack, block }: PropsWithChildren<{ stack: Stack; block: Block; }>) {
    const rotateBlock = useGameState(state => state.rotateBlock);

    const rotateInitiated = useRef(false);
    const handleContextMenu = (event: ThreeEvent<MouseEvent>) => {
        event.nativeEvent.preventDefault();
        event.stopPropagation();
        rotateInitiated.current = true;
    };

    const doubleClickDownTimeStamp = useRef(0);
    const firstClickTimeStamp = useRef(0);
    const handlePointerDown = (event: ThreeEvent<globalThis.PointerEvent>) => {
        if (event.pointerType !== 'touch') return;

        doubleClickDownTimeStamp.current = Date.now();
        if (doubleClickDownTimeStamp.current - firstClickTimeStamp.current > 1000) {
            firstClickTimeStamp.current = 0;
        }
    }

    const handleRotateCancel = () => {
        rotateInitiated.current = false;
    };

    const handlePointerUp = (event: ThreeEvent<globalThis.PointerEvent>, stack: Stack, block: Block) => {
        // Handle touch double-click rotation
        if (event.pointerType === 'touch') {
            // If we have first click and second click is within 600ms, we have double click
            if (Date.now() - firstClickTimeStamp.current < 600) {
                rotateInitiated.current = true;
                firstClickTimeStamp.current = 0;
            } else if (Date.now() - doubleClickDownTimeStamp.current < 300) {
                firstClickTimeStamp.current = Date.now();
            }
        }

        if (!rotateInitiated.current)
            return;

        if (event.nativeEvent.cancelable)
            event.nativeEvent.preventDefault();
        event.stopPropagation();
        rotateBlock(stack.position, block);
        rotateInitiated.current = false;
    };

    return (
        <group
            onContextMenu={handleContextMenu}
            onPointerDown={handlePointerDown}
            onPointerMove={handleRotateCancel}
            onPointerLeave={handleRotateCancel}
            onPointerUp={(event) => handlePointerUp(event, stack, block)}>
            {children}
        </group>
    );
}
