import { ThreeEvent } from "@react-three/fiber";
import { PropsWithChildren, useRef } from "react";
import type { Block } from "../types/Block";
import { useGameState } from "../useGameState";
import { useBlockRotate } from "../hooks/useBlockRotate";
import type { Vector3 } from "three";

export function RotatableGroup({ children, block }: PropsWithChildren<{ block: Block; }>) {
    const blockRotate = useBlockRotate();
    const effectsAudioMixer = useGameState((state) => state.audio.effects);
    const isDragging = useGameState(state => state.isDragging);
    const swipeSound = effectsAudioMixer.useSoundEffect('https://cdn.gredice.com/sounds/effects/Swipe Generic 01.mp3');

    const rotateInitiated = useRef<Vector3>(null);
    const doubleClickDownTimeStamp = useRef(0);
    const firstClickTimeStamp = useRef(0);

    async function doRotate(event: ThreeEvent<globalThis.PointerEvent> | ThreeEvent<MouseEvent>) {
        if (!rotateInitiated.current)
            return;

        if (isDragging)
            return;

        event.stopPropagation();
        blockRotate.mutate({ blockId: block.id, rotation: block.rotation + 1 });
        rotateInitiated.current = null;

        // TODO: Don't play sound if rotation is not possible
        swipeSound.play();
    }

    function handlePointerDown(event: ThreeEvent<globalThis.PointerEvent>) {
        if (event.button === 2) {
            rotateInitiated.current = event.point;
        }

        doubleClickDownTimeStamp.current = Date.now();
        if (doubleClickDownTimeStamp.current - firstClickTimeStamp.current > 1000) {
            firstClickTimeStamp.current = 0;
        }
    }

    function handleRotateCancel() {
        console.debug("Rotate cancel - leave");
        rotateInitiated.current = null;
    }

    function handlePointerUp(event: ThreeEvent<globalThis.PointerEvent>) {
        // Cancel if the pointer moved
        if (rotateInitiated.current && event.point.distanceTo(rotateInitiated.current) > 0.1) {
            rotateInitiated.current = null;
            console.debug("Rotate cancel - moved");
            return;
        }

        const now = Date.now();
        if (now - firstClickTimeStamp.current < 600) {
            rotateInitiated.current = event.point;
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
            onPointerLeave={handleRotateCancel}
            onPointerUp={handlePointerUp}>
            {children}
        </group>
    );
}
