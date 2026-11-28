'use client';

import { useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import { useGameState, useGameStateStore } from '../useGameState';
import { isBlockEditingBlockGone } from './blockEditingTarget';
import { clearBlockExpansionPlanCache } from './expand/useBlockExpansionPlan';

/**
 * Whether an Escape press belongs to a dialog: focus is inside one (modals
 * trap focus there) or a native modal dialog is open. A non-modal popover
 * that merely stays open, such as the controls help, does not take Escape
 * away from the pop-up.
 */
function isEscapeForDialog(event: KeyboardEvent) {
    const target = event.target instanceof Element ? event.target : null;
    return (
        Boolean(
            target?.closest('[role="dialog"], [role="alertdialog"], dialog'),
        ) || document.querySelector('dialog:modal') !== null
    );
}

/**
 * Closes block editing when its context goes away (spec §3.6). Mounted once
 * inside the Canvas by `BlockOptionsScene`; every listener is attached only
 * while a mode that needs it is active.
 *
 * - Pop-up (`menu`): Escape, a pointerdown on the canvas (not swallowed, so
 *   pans, pinches and new holds proceed), the block disappearing, a garden
 *   change, the close-up or avatar view, a pack layout preview, a HUD item
 *   drag or another pickup.
 * - Expand: the same, except a canvas pointerdown (it sets the corner) and
 *   Escape while the batch is pending.
 * - Remove confirmation: the block disappearing (not while the removal is
 *   pending: its optimistic update takes the block out of the cache before
 *   the request settles) or a garden change.
 * - Moving and carry: the pickup session ending.
 *
 * The 2D view is handled by `GameHud`, which knows the view mode.
 */
export function useBlockEditingAutoClose() {
    const store = useGameStateStore();
    const canvas = useThree((state) => state.gl.domElement);
    const mode = useGameState((state) => state.blockEditing?.mode ?? null);
    const blockId = useGameState(
        (state) => state.blockEditing?.blockId ?? null,
    );
    const expandPending = useGameState(
        (state) =>
            state.blockEditing?.mode === 'expand' && state.blockEditing.pending,
    );
    const removePending = useGameState(
        (state) =>
            state.blockEditing?.mode === 'confirm-remove' &&
            state.blockEditing.pending,
    );
    const closeBlockEditing = useGameState((state) => state.closeBlockEditing);
    const interrupted = useGameState(
        (state) =>
            state.view === 'closeup' ||
            state.gardenAvatarView !== 'overview' ||
            state.packLayoutPreview !== null ||
            state.hudPlacementDrag !== null ||
            state.pickupBlock !== null,
    );
    const pickupActive = useGameState((state) => state.pickupBlock !== null);
    const { data: garden } = useCurrentGarden();
    const gardenId = garden === undefined ? undefined : (garden?.id ?? null);
    const lastGardenIdRef = useRef(gardenId);

    // A pop-up or Expand left behind by an unmounted scene has no UI.
    useEffect(() => () => store.getState().closeBlockEditing(), [store]);

    // The plan cache holds a garden snapshot; drop it once Expand ends.
    useEffect(() => {
        if (mode !== 'expand') {
            clearBlockExpansionPlanCache();
        }
    }, [mode]);

    useEffect(() => {
        if ((mode === 'menu' || mode === 'expand') && interrupted) {
            closeBlockEditing();
        }
    }, [closeBlockEditing, interrupted, mode]);

    useEffect(() => {
        if ((mode === 'moving' || mode === 'carry') && !pickupActive) {
            closeBlockEditing();
        }
    }, [closeBlockEditing, mode, pickupActive]);

    useEffect(() => {
        if (gardenId === undefined) {
            return;
        }

        const lastGardenId = lastGardenIdRef.current;
        lastGardenIdRef.current = gardenId;
        if (
            lastGardenId !== undefined &&
            lastGardenId !== gardenId &&
            store.getState().blockEditing
        ) {
            closeBlockEditing();
        }
    }, [closeBlockEditing, gardenId, store]);

    useEffect(() => {
        if (isBlockEditingBlockGone({ blockId, garden, mode, removePending })) {
            closeBlockEditing();
        }
    }, [blockId, closeBlockEditing, garden, mode, removePending]);

    const escapeCloses =
        mode === 'menu' || (mode === 'expand' && !expandPending);
    useEffect(() => {
        if (!escapeCloses) {
            return;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (
                event.key !== 'Escape' ||
                event.defaultPrevented ||
                isEscapeForDialog(event)
            ) {
                return;
            }

            const editing = store.getState().blockEditing;
            if (
                editing?.mode === 'menu' ||
                (editing?.mode === 'expand' && !editing.pending)
            ) {
                event.preventDefault();
                store.getState().closeBlockEditing();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [escapeCloses, store]);

    useEffect(() => {
        if (mode !== 'menu') {
            return;
        }

        const handlePointerDown = () => {
            if (store.getState().blockEditing?.mode === 'menu') {
                store.getState().closeBlockEditing();
            }
        };

        canvas.addEventListener('pointerdown', handlePointerDown, {
            passive: true,
        });
        return () =>
            canvas.removeEventListener('pointerdown', handlePointerDown);
    }, [canvas, mode, store]);
}
