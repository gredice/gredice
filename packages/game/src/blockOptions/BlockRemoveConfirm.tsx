'use client';

import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { useId, useMemo, useRef, useState } from 'react';
import { useGameAnalytics } from '../analytics/GameAnalyticsContext';
import { useBlockData } from '../hooks/useBlockData';
import { useBlockDelete } from '../hooks/useBlockDelete';
import { useBlockRecycle } from '../hooks/useBlockRecycle';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import { useShoppingCart } from '../hooks/useShoppingCart';
import { GameModal } from '../shared-ui/game-modal';
import { useGameState, useGameStateStore } from '../useGameState';
import { triggerPlaceHaptic } from '../utils/haptics';
import {
    BlockOptionsMedallion,
    blockOptionsCandyClassName,
    blockOptionsChipClassName,
} from './BlockOptionsArt';
import { getBlockOptionsBlockLabel } from './blockOptionsActions';
import { blockRemoveCopy } from './blockOptionsCopy';
import {
    type BlockRemovalPlan,
    type BlockRemovalRefund,
    planBlockRemoval,
} from './blockRemoval';

const dropSoundUrl = 'https://cdn.gredice.com/sounds/effects/Drop Grass 01.mp3';

function refundMessage(refund: BlockRemovalRefund | null) {
    if (!refund) {
        return null;
    }
    if (refund.kind === 'amount') {
        return blockRemoveCopy.refund(refund.amount);
    }
    return refund.kind === 'none'
        ? blockRemoveCopy.noRefund
        : blockRemoveCopy.refundUnknown;
}

type RemoveDialogView = {
    sequence: number;
    plan: BlockRemovalPlan;
    label: string;
};

/**
 * The confirmation behind the pop-up's Recikliraj/Obriši (spec §5). It lives
 * in the HUD so it outlives the pop-up, and removes exactly what dropping the
 * lifted block on the HUD recycler would: the block alone with a stack patch,
 * or the block and everything on it with one DELETE per block (sandbox
 * gardens always delete). The body names what goes with it, and the refund
 * line shows the sunflowers the server will give back when every removed
 * block's paid price is known.
 *
 * While the request is in flight the dialog stays open and cannot be
 * dismissed; it closes on success and shows the error otherwise (the hooks
 * restore the garden then).
 *
 * It reads as a game card: the compost crate (or the sandbox's red bin)
 * bounces in on a candy medallion, a refund sits on a sunflower chip, and
 * the answers are candy buttons, green to recycle and red to delete.
 */
export function BlockRemoveConfirm() {
    const store = useGameStateStore();
    const editing = useGameState((state) =>
        state.blockEditing?.mode === 'confirm-remove'
            ? state.blockEditing
            : null,
    );
    const isLocalSandbox = useGameState(
        (state) => state.localSandboxStorageKey !== null,
    );
    const effectsAudioMixer = useGameState((state) => state.audio.effects);
    const dropSound = effectsAudioMixer.useSoundEffect(dropSoundUrl);
    const { data: garden } = useCurrentGarden();
    const { data: blockData } = useBlockData();
    const { data: shoppingCart } = useShoppingCart(!isLocalSandbox);
    const recycleBlock = useBlockRecycle();
    const deleteBlocks = useBlockDelete();
    const { track } = useGameAnalytics();
    const [confirmedView, setConfirmedView] = useState<RemoveDialogView | null>(
        null,
    );
    const [errorSequence, setErrorSequence] = useState<number | null>(null);
    const bodyId = useId();
    const refundId = useId();

    const blockId = editing?.blockId ?? null;
    const sequence = editing?.sequence ?? null;
    const livePlan = useMemo(
        () =>
            blockId
                ? planBlockRemoval({
                      blockData,
                      blockId,
                      cartItems: shoppingCart?.items,
                      garden,
                  })
                : null,
        [blockData, blockId, garden, shoppingCart?.items],
    );
    // While the removal is pending its optimistic update has already taken
    // the block out of the garden, so the dialog keeps what it confirmed.
    const view: RemoveDialogView | null =
        sequence === null
            ? null
            : confirmedView?.sequence === sequence
              ? confirmedView
              : livePlan
                ? {
                      sequence,
                      plan: livePlan,
                      label: getBlockOptionsBlockLabel(
                          blockData,
                          livePlan.blockName,
                      ),
                  }
                : null;
    // The last content stays while the dialog animates out.
    const lastViewRef = useRef<RemoveDialogView | null>(null);
    if (view) {
        lastViewRef.current = view;
    }
    const shown = view ?? lastViewRef.current;
    const open = editing !== null && view !== null;
    const pending = editing?.pending ?? false;
    const failed = sequence !== null && errorSequence === sequence;

    function handleOpenChange(nextOpen: boolean) {
        if (nextOpen) {
            return;
        }
        const current = store.getState().blockEditing;
        if (current?.mode === 'confirm-remove' && !current.pending) {
            store.getState().closeBlockEditing();
        }
    }

    async function handleConfirm() {
        const current = store.getState().blockEditing;
        if (current?.mode !== 'confirm-remove' || current.pending || !view) {
            return;
        }

        const { plan } = view;
        const confirmedSequence = current.sequence;
        setConfirmedView(view);
        setErrorSequence(null);
        store.getState().setBlockRemovePending(true);
        dropSound.play();
        triggerPlaceHaptic();
        track('game_block_remove_confirmed', {
            block_name: plan.blockName,
            removal: plan.action,
            removed_count: plan.blockIds.length,
        });

        const isStillThisDialog = () => {
            const after = store.getState().blockEditing;
            return (
                after?.mode === 'confirm-remove' &&
                after.sequence === confirmedSequence
            );
        };
        try {
            if (plan.action === 'recycle') {
                await recycleBlock.mutateAsync({
                    position: plan.position,
                    blockId: plan.blockId,
                    blockIndex: plan.blockIndex,
                    raisedBedId: plan.raisedBedId ?? undefined,
                });
            } else {
                await deleteBlocks.mutateAsync({ blockIds: plan.blockIds });
            }
            if (isStillThisDialog()) {
                store.getState().closeBlockEditing();
            }
        } catch {
            setConfirmedView(null);
            if (isStillThisDialog()) {
                store.getState().setBlockRemovePending(false);
                setErrorSequence(confirmedSequence);
            }
        }
    }

    if (!shown) {
        return null;
    }

    // Sandbox gardens delete; everywhere else the block is recycled, even
    // when a stacked segment is removed block by block.
    const isDelete = Boolean(garden?.isSandbox);
    const copy = isDelete ? blockRemoveCopy.delete : blockRemoveCopy.recycle;
    const header = copy.header(shown.label);
    const refund = refundMessage(shown.plan.refund);
    const confirmTone = isDelete ? 'ripe' : 'grass';

    return (
        <GameModal
            // The body (what else goes, the cart items) and the refund are
            // what the player confirms, so they are read with the title.
            aria-describedby={refund ? `${bodyId} ${refundId}` : bodyId}
            className="md:max-w-md"
            dismissible={!pending}
            hideClose
            onOpenChange={handleOpenChange}
            open={open}
            title={header}
        >
            <Stack spacing={4} data-block-remove-confirm={shown.plan.action}>
                <Row spacing={3}>
                    <BlockOptionsMedallion
                        art={isDelete ? 'delete' : 'recycle'}
                        pop
                        popIndex="late"
                        size="lg"
                    />
                    {/* The dialog's title (read by screen readers) is the
                        same text; this is its visible copy. */}
                    <Typography
                        aria-hidden
                        className="min-w-0 font-extrabold"
                        component="p"
                        level="h5"
                    >
                        {header}
                    </Typography>
                </Row>
                <Typography id={bodyId} level="body1" data-block-remove-body>
                    {blockRemoveCopy.body({
                        label: shown.label,
                        stackedCount: shown.plan.stackedCount,
                        cartItemCount: shown.plan.cartItemCount,
                    })}
                </Typography>
                {refund ? (
                    <Typography
                        id={refundId}
                        level="body2"
                        className={
                            shown.plan.refund?.kind === 'amount'
                                ? cx(
                                      blockOptionsChipClassName,
                                      'self-start px-3 py-1',
                                  )
                                : undefined
                        }
                        secondary={shown.plan.refund?.kind !== 'amount'}
                        data-block-remove-refund={
                            shown.plan.refund?.kind ?? 'none'
                        }
                    >
                        {refund}
                    </Typography>
                ) : null}
                {failed ? (
                    <Alert color="danger">{blockRemoveCopy.error}</Alert>
                ) : null}
                <Row justifyContent="end" spacing={2}>
                    <Button
                        className={blockOptionsCandyClassName('h-11 px-4')}
                        data-tone="cream"
                        disabled={pending}
                        onClick={() => handleOpenChange(false)}
                        type="button"
                        variant="plain"
                    >
                        {blockRemoveCopy.cancel}
                    </Button>
                    <Button
                        className={blockOptionsCandyClassName('h-11 px-5')}
                        data-tone={confirmTone}
                        loading={pending}
                        onClick={() => void handleConfirm()}
                        type="button"
                        variant="plain"
                    >
                        {copy.confirm}
                    </Button>
                </Row>
            </Stack>
        </GameModal>
    );
}
