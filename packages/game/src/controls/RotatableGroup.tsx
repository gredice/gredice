import type { ThreeEvent } from '@react-three/fiber';
import { type PropsWithChildren, useRef } from 'react';
import type { Vector3 } from 'three';
import { useBlockRotate } from '../hooks/useBlockRotate';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import type { Block } from '../types/Block';
import { useGameState } from '../useGameState';
import { findAttachedRaisedBedBlockId } from '../utils/raisedBedBlocks';

const ROTATE_DRAG_THRESHOLD = 0.1;

export function RotatableGroup({
    children,
    block,
}: PropsWithChildren<{ block: Block }>) {
    const blockRotate = useBlockRotate();
    const { data: garden } = useCurrentGarden();
    const effectsAudioMixer = useGameState((state) => state.audio.effects);
    const isDragging = useGameState((state) => state.isDragging);
    const swipeSound = effectsAudioMixer.useSoundEffect(
        'https://cdn.gredice.com/sounds/effects/Swipe Generic 01.mp3',
    );

    const rotateInitiated = useRef<Vector3>(null);
    const doubleClickDownTimeStamp = useRef(0);
    const firstClickTimeStamp = useRef(0);

    async function doRotate(
        event: ThreeEvent<globalThis.PointerEvent> | ThreeEvent<MouseEvent>,
    ) {
        if (!rotateInitiated.current) return;

        if (isDragging) return;

        event.stopPropagation();

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
        rotateInitiated.current = null;

        swipeSound.play();
    }

    function handlePointerDown(event: ThreeEvent<globalThis.PointerEvent>) {
        if (event.button === 2) {
            rotateInitiated.current = event.point;
        }

        doubleClickDownTimeStamp.current = Date.now();
        if (
            doubleClickDownTimeStamp.current - firstClickTimeStamp.current >
            1000
        ) {
            firstClickTimeStamp.current = 0;
        }
    }

    function handleRotateCancel() {
        rotateInitiated.current = null;
    }

    function handlePointerUp(event: ThreeEvent<globalThis.PointerEvent>) {
        if (
            rotateInitiated.current &&
            event.point.distanceTo(rotateInitiated.current) >
                ROTATE_DRAG_THRESHOLD
        ) {
            rotateInitiated.current = null;
            return;
        }

        const now = Date.now();
        if (now - firstClickTimeStamp.current < 600) {
            rotateInitiated.current = event.point;
            firstClickTimeStamp.current = 0;
        } else if (now - doubleClickDownTimeStamp.current < 300) {
            firstClickTimeStamp.current = now;
        }

        if (!rotateInitiated.current) return;

        doRotate(event);
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
