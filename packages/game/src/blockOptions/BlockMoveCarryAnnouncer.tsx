'use client';

import { useGameState } from '../useGameState';
import { blockMoveCopy } from './blockOptionsCopy';

/** The carry hint for a pointer type (`keyboard` reads as the mouse one). */
export function getBlockMoveCarryMessage(pointerType: string) {
    return pointerType === 'touch'
        ? blockMoveCopy.carryTouch
        : blockMoveCopy.carryMouse;
}

/**
 * The carry hint for screen readers: a live region that stays in the HUD,
 * so the hint is announced when carry starts. The visible bubble
 * (`BlockMoveCarryBubble`) mounts with its text in a new layer, which
 * screen readers do not announce reliably. No three.js here: the HUD is
 * also bundled for the 2D overview.
 */
export function BlockMoveCarryAnnouncer() {
    const pointerType = useGameState((state) =>
        state.blockEditing?.mode === 'carry'
            ? state.blockEditing.pointerType
            : null,
    );

    return (
        <p className="sr-only" data-block-move-carry-announcer role="status">
            {pointerType === null ? '' : getBlockMoveCarryMessage(pointerType)}
        </p>
    );
}
