import { ThreeEvent } from "@react-three/fiber";
import { PropsWithChildren, useRef } from "react";
import type { Block } from "../types/Block";
import type { Stack } from "../types/Stack";
import { useGameState } from "../useGameState";

export function RotatableGroup({ children, stack, block }: PropsWithChildren<{ stack: Stack; block: Block; }>) {
    const rotateBlock = useGameState(state => state.rotateBlock);
    const effectsAudioMixer = useGameState((state) => state.audio.effects);
    const isDragging = useGameState(state => state.isDragging);
    const swipeSound = effectsAudioMixer.useSoundEffect('https://cdn.gredice.com/sounds/effects/Swipe Generic 01.mp3');

    const rotateInitiated = useRef(false);

    function doRotate(event: ThreeEvent<globalThis.PointerEvent> | ThreeEvent<MouseEvent>) {
        if (!rotateInitiated.current)
            return;

        if (isDragging)
            return;

        event.stopPropagation();
        rotateBlock(stack.position, block);
        rotateInitiated.current = false;

        // TODO: Don't play sound if rotation is not possible
        swipeSound.play();
    }

    const doubleClickDownTimeStamp = useRef(0);
    const firstClickTimeStamp = useRef(0);
    function handlePointerDown(event: ThreeEvent<globalThis.PointerEvent>) {
        if (event.button === 2) {
            rotateInitiated.current = true;
        }

        doubleClickDownTimeStamp.current = Date.now();
        if (doubleClickDownTimeStamp.current - firstClickTimeStamp.current > 1000) {
            firstClickTimeStamp.current = 0;
        }
    }

    function handleRotateCancel() {
        rotateInitiated.current = false;
    }

    function handlePointerUp(event: ThreeEvent<globalThis.PointerEvent>, stack: Stack, block: Block) {
        const now = Date.now();
        if (now - firstClickTimeStamp.current < 600) {
            rotateInitiated.current = true;
            firstClickTimeStamp.current = 0;
        } else if (now - doubleClickDownTimeStamp.current < 300) {
            firstClickTimeStamp.current = now;
        }

        if (!rotateInitiated.current)
            return;

        doRotate(event);
    }

    return (
        <group
            onPointerDown={handlePointerDown}
            onPointerMove={handleRotateCancel}
            onPointerLeave={handleRotateCancel}
            onPointerUp={(event) => handlePointerUp(event, stack, block)}>
            {children}
        </group>
    );
}
