import type { ThreeEvent } from '@react-three/fiber';
import { type PropsWithChildren, useRef } from 'react';
import type { Vector3 } from 'three';
import { useBlockRotate } from '../hooks/useBlockRotate';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import type { Block } from '../types/Block';
import { useGameState } from '../useGameState';
import { findAttachedRaisedBedBlockId } from '../utils/raisedBedBlocks';

const ROTATE_DRAG_THRESHOLD = 0.1;
const DOUBLE_TAP_THRESHOLD_MS = 320;

export function RotatableGroup({
    children,
    block,
}: PropsWithChildren<{ block: Block }>) {
    const blockRotate = useBlockRotate();
    const { data: garden } = useCurrentGarden();
    const effectsAudioMixer = useGameState((state) => state.audio.effects);
    const isDragging = useGameState((state) => state.isDragging);
    const pickupBlock = useGameState((state) => state.pickupBlock);
    const swipeSound = effectsAudioMixer.useSoundEffect(
        'https://cdn.gredice.com/sounds/effects/Swipe Generic 01.mp3',
    );

    const rotatePointerDownPoint = useRef<Vector3 | null>(null);
    const firstTapTimeStamp = useRef(0);

    function doRotate() {
        if (isDragging || pickupBlock) return false;

        const attachedRaisedBedBlockId =
            block.name === 'Raised_Bed' && garden
                ? findAttachedRaisedBedBlockId(garden.stacks, block.id)
                : null;
        const blockIds = attachedRaisedBedBlockId
            ? [block.id, attachedRaisedBedBlockId]
            : [block.id];

        blockRotate.mutate({
            blockId: block.id,
            rotation: block.rotation + 1,
            blockIds,
        });

        swipeSound.play();
        return true;
    }

    function handlePointerDown(event: ThreeEvent<globalThis.PointerEvent>) {
        if (event.button !== 0) {
            return;
        }

        rotatePointerDownPoint.current = event.point.clone();
    }

    function handleRotateCancel() {
        rotatePointerDownPoint.current = null;
    }

    function handlePointerUp(event: ThreeEvent<globalThis.PointerEvent>) {
        if (event.button !== 0) {
            return;
        }

        const pointerDownPoint = rotatePointerDownPoint.current;
        rotatePointerDownPoint.current = null;

        if (!pointerDownPoint) {
            return;
        }

        if (event.point.distanceTo(pointerDownPoint) > ROTATE_DRAG_THRESHOLD) {
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
