'use client';

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

    const handleRotateCancel = () => {
        rotateInitiated.current = false;
    };

    const handlePointerUp = (event: ThreeEvent<globalThis.PointerEvent>, stack: Stack, block: Block) => {
        if (rotateInitiated.current) {
            event.nativeEvent.preventDefault();
            event.stopPropagation();
            rotateBlock(stack.position, block);
            rotateInitiated.current = false;
        }
    };

    return (
        <group
            onContextMenu={handleContextMenu}
            onPointerMove={handleRotateCancel}
            onPointerLeave={handleRotateCancel}
            onPointerUp={(event) => handlePointerUp(event, stack, block)}>
            {children}
        </group>
    );
}
