'use client';

import { useRef } from 'react';
import { BlockMoveCarryAnnouncer } from './BlockMoveCarryAnnouncer';
import { BlockRemoveConfirm } from './BlockRemoveConfirm';
import { BlockExpandHud } from './expand/BlockExpandHud';
import { useBlockOptionsHudObstacles } from './useBlockOptionsHudObstacles';

/**
 * The HUD part of block editing: the remove confirmation, the Expand bar
 * and the carry hint's live region, which must outlive the in-scene
 * pop-up. It also measures the HUD regions the pop-up has to avoid.
 * `GameHud` mounts it at one place in every view (3D, 2D and avatar), so a
 * pending Expand keeps its state and can be recovered anywhere; its
 * children decide their own visibility from the store.
 */
export function BlockOptionsHud() {
    const hudRootMarkerRef = useRef<HTMLSpanElement>(null);
    useBlockOptionsHudObstacles(hudRootMarkerRef);

    return (
        <>
            <span ref={hudRootMarkerRef} hidden data-block-options-hud />
            <BlockRemoveConfirm />
            <BlockExpandHud />
            <BlockMoveCarryAnnouncer />
        </>
    );
}
