'use client';

import { Suspense, useEffect } from 'react';
import { holdBlockInteractions } from '../controls/blockInteractionSuppression';
import { useGameState, useGameStateStore } from '../useGameState';
import { BlockMoveCarryBubble } from './BlockMoveCarryBubble';
import { BlockOptionsPopupLayer } from './BlockOptionsPopupLayer';
import { BlockExpandPreviewLayer } from './expand/BlockExpandPreviewLayer';
import { useBlockEditingAutoClose } from './useBlockEditingAutoClose';

/**
 * The in-scene part of block editing, mounted inside the Canvas: the options
 * pop-up (kept mounted while a move it started is running), the carry hint
 * and the Expand preview. It also closes editing when its context goes away.
 *
 * While it is mounted a hold-release may open the pop-up (a hidden HUD does
 * not mount it). While Expand is open, block taps and clicks are suppressed:
 * Expand owns canvas taps (D6), so a corner tap on a gate or a garden box
 * must not also toggle or open it.
 */
export function BlockOptionsScene() {
    useBlockEditingAutoClose();
    const store = useGameStateStore();
    const mode = useGameState((state) => state.blockEditing?.mode ?? null);

    useEffect(() => store.getState().registerBlockOptionsUi(), [store]);
    useEffect(
        () => (mode === 'expand' ? holdBlockInteractions() : undefined),
        [mode],
    );

    return (
        <Suspense fallback={null}>
            {mode === 'menu' || mode === 'moving' ? (
                <BlockOptionsPopupLayer />
            ) : null}
            {mode === 'carry' ? <BlockMoveCarryBubble /> : null}
            {mode === 'expand' ? <BlockExpandPreviewLayer /> : null}
        </Suspense>
    );
}
