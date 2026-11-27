import type { ThreeEvent } from '@react-three/fiber';
import { type PropsWithChildren, useContext, useRef } from 'react';
import { useBlockRotate } from '../hooks/useBlockRotate';
import type { Block } from '../types/Block';
import type { Stack } from '../types/Stack';
import { GameStateContext, useGameState } from '../useGameState';
import { useBlockInteractionTargetRegistration } from './BlockInteractionRegistry';
import { areBlockInteractionsSuppressed } from './blockInteractionSuppression';
import {
    canRotatePlacedBlock,
    didPointerLeaveRotationTarget,
    isRotationTapDrag,
    type RotationTapPointer,
} from './blockRotation';

const DOUBLE_TAP_THRESHOLD_MS = 320;

export function RotatableGroup({
    children,
    block,
    interactionTargetKey,
    stack,
    blockIndex,
}: PropsWithChildren<{
    block: Block;
    blockIndex?: number;
    interactionTargetKey?: string;
    stack?: Stack;
}>) {
    const blockRotate = useBlockRotate();
    const gameStateStore = useContext(GameStateContext);
    const effectsAudioMixer = useGameState((state) => state.audio.effects);
    const swipeSound = effectsAudioMixer.useSoundEffect(
        'https://cdn.gredice.com/sounds/effects/Swipe Generic 01.mp3',
    );

    const rotatePointerDown = useRef<RotationTapPointer | null>(null);
    const firstTapTimeStamp = useRef(0);

    function doRotate() {
        if (!canRotatePlacedBlock(block.name)) {
            return false;
        }

        // A tap right after a hold-release (which opened the options pop-up)
        // is not a double-click, and Expand switches rotation off (D6).
        const gameState = gameStateStore?.getState();
        if (
            gameState?.isDragging ||
            gameState?.pickupBlock ||
            gameState?.hudPlacementDrag ||
            gameState?.blockEditing?.mode === 'expand' ||
            areBlockInteractionsSuppressed()
        ) {
            return false;
        }

        blockRotate.mutate({
            blockId: block.id,
            rotation: block.rotation + 1,
            blockIds: [block.id],
        });

        swipeSound.play();
        return true;
    }

    function handlePointerDown(event: ThreeEvent<globalThis.PointerEvent>) {
        if (event.button !== 0) {
            return;
        }

        const { clientX, clientY, pointerType } = event.nativeEvent;
        rotatePointerDown.current = { clientX, clientY, pointerType };
    }

    function handleRotateCancel(event: ThreeEvent<globalThis.PointerEvent>) {
        if (!didPointerLeaveRotationTarget(event)) {
            return;
        }

        rotatePointerDown.current = null;
    }

    function handlePointerUp(event: ThreeEvent<globalThis.PointerEvent>) {
        if (event.button !== 0) {
            return;
        }

        const pointerDown = rotatePointerDown.current;
        rotatePointerDown.current = null;

        if (!pointerDown) {
            return;
        }

        if (isRotationTapDrag(pointerDown, event.nativeEvent)) {
            firstTapTimeStamp.current = 0;
            return;
        }

        const now = Date.now();
        if (now - firstTapTimeStamp.current >= DOUBLE_TAP_THRESHOLD_MS) {
            firstTapTimeStamp.current = now;
            return;
        }

        firstTapTimeStamp.current = 0;

        if (doRotate()) {
            event.stopPropagation();
        }
    }

    useBlockInteractionTargetRegistration(
        interactionTargetKey && stack && blockIndex !== undefined
            ? interactionTargetKey
            : undefined,
        stack && blockIndex !== undefined
            ? {
                  block,
                  blockIndex,
                  stack,
              }
            : undefined,
        {
            onRotatePointerDown: handlePointerDown,
            onRotatePointerLeave: handleRotateCancel,
            onRotatePointerUp: handlePointerUp,
        },
    );

    if (interactionTargetKey) {
        return <>{children}</>;
    }

    return (
        <group
            onPointerDown={handlePointerDown}
            onPointerLeave={handleRotateCancel}
            onPointerUp={handlePointerUp}
        >
            {children}
        </group>
    );
}
