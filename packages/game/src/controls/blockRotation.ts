import { getPickupPointerMoveCancelDistance } from './instancedBlockInteractionCore';

const rotationLockedBlockNames = new Set([
    'Cow',
    'FishingBoat',
    'Horse',
    'Raised_Bed',
]);

export function canRotatePlacedBlock(blockName: string) {
    return !rotationLockedBlockNames.has(blockName);
}

export type RotationTapPointer = {
    clientX: number;
    clientY: number;
    pointerType: string;
};

/**
 * Whether the pointer travelled far enough between press and release to be a
 * drag rather than a tap. It is measured on screen: a block bouncing from the
 * first tap moves its surface under a pointer that has not moved.
 */
export function isRotationTapDrag(
    down: RotationTapPointer,
    up: RotationTapPointer,
) {
    return (
        Math.hypot(up.clientX - down.clientX, up.clientY - down.clientY) >
        getPickupPointerMoveCancelDistance(up.pointerType)
    );
}

type RotationPointerLeave = {
    eventObject: object;
    intersections: readonly { eventObject: object }[];
};

/**
 * Whether a pointer leave means the pointer left the block. r3f also reports
 * a leave for one mesh of a group while another mesh of that group is still
 * under the pointer, as when a bouncing block slides a different part under
 * a pointer that has not moved; the press still belongs to the block then.
 */
export function didPointerLeaveRotationTarget(event: RotationPointerLeave) {
    return !event.intersections.some(
        (hit) => hit.eventObject === event.eventObject,
    );
}
