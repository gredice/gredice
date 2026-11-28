'use client';

import { useEffect, useState } from 'react';
import { useGameAnalytics } from '../../analytics/GameAnalyticsContext';
import { useBlockData } from '../../hooks/useBlockData';
import type { useBlockPlaceBatch } from '../../hooks/useBlockPlaceBatch';
import { useCurrentAccount } from '../../hooks/useCurrentAccount';
import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import { useShoppingCart } from '../../hooks/useShoppingCart';
import { getHudEntityPlacementAvailability } from '../../hud/itemPlacementAvailability';
import { useGameState, useGameStateStore } from '../../useGameState';
import type { BlockEditingCell } from '../blockEditingState';
import {
    BlockExpandPanel,
    type BlockExpandPanelEarlier,
    type BlockExpandPanelProps,
} from './BlockExpandPanel';
import {
    buildBlockExpandRequestBody,
    resolveBlockExpandFailure,
} from './blockExpandRequest';
import {
    isExpandAlertInStatus,
    resolveExpandAffordability,
    resolveExpandStatusMessage,
} from './expandAffordability';
import type { PendingBlockExpand } from './pendingBlockExpand';
import { useBlockExpansionPlan } from './useBlockExpansionPlan';

/** The plan as confirmed, shown unchanged while it is being placed. */
type FrozenPlan = {
    blockName: string;
    width: number;
    depth: number;
    count: number;
    skippedCount: number;
    total: number;
    /** Sandbox gardens show no balance. */
    isSandbox: boolean;
};

/**
 * An error of the last confirm (or of checking a lost request again), shown
 * while the same Expand has the same corner marked.
 */
export type BlockExpandAlert = {
    sequence: number;
    corner: BlockEditingCell;
    message: string;
};

/**
 * The open Expand, kept by `BlockExpandHud` (which outlives the editor) so
 * it can report a cancel when the Expand ends without a confirm.
 */
export type BlockExpandSession = {
    sequence: number;
    blockName: string;
    count: number;
    confirmed: boolean;
};

/** How a confirmed plan ended, for the bar that outlives the editor. */
export type BlockExpandConfirmResult =
    | { kind: 'placed'; blockName: string; count: number; charged: number }
    | {
          kind: 'uncertain';
          /** The Expand that was confirmed; it stays locked. */
          sequence: number;
          command: PendingBlockExpand;
      }
    | {
          /** Nothing was placed; the editor shows why while it is open. */
          kind: 'failed';
          /** The Expand that was confirmed. */
          sequence: number;
          blockName: string;
          count: number;
      };

function isSameCell(left: BlockEditingCell, right: BlockEditingCell) {
    return left.x === right.x && left.z === right.z;
}

/**
 * The Expand bar while Expand is open (spec §7.6): the live plan, its cost
 * against the HUD balance (balance minus the cart, OPEN-4) and why Potvrdi
 * is disabled; after Potvrdi, the confirmed plan frozen until the batch
 * settles. `BlockExpandHud` loads it lazily, because the planner imports
 * the 3D entity modules, which the 2D overview must not bundle.
 */
export function BlockExpandEditor({
    blockedReason = null,
    confirm,
    earlier = null,
    initialAlert = null,
    onConfirmSettled,
    onConfirmStart,
    session,
    userId,
}: {
    /**
     * Why Potvrdi waits even for an affordable plan, e.g. a stored request
     * that has to be checked or dropped first. Shown as the status.
     */
    blockedReason?: string | null;
    confirm: ReturnType<typeof useBlockPlaceBatch>['confirm'];
    /** A stored request (or its outcome) offered above this Expand. */
    earlier?: BlockExpandPanelEarlier | null;
    /**
     * An error to show when the editor opens, e.g. why checking a lost
     * request again failed. Read on mount only.
     */
    initialAlert?: BlockExpandAlert | null;
    /** Called once a confirmed plan is placed, lost or rejected. */
    onConfirmSettled: (result: BlockExpandConfirmResult) => void;
    /** Called when Potvrdi sends a plan. */
    onConfirmStart: () => void;
    /** The open Expand; the editor records its count and confirm. */
    session: { current: BlockExpandSession | null };
    userId: string | null;
}) {
    const store = useGameStateStore();
    const editing = useGameState((state) =>
        state.blockEditing?.mode === 'expand' ? state.blockEditing : null,
    );
    const planResult = useBlockExpansionPlan();
    // The corner knob keeps clear of the bar (`ExpandHandle`).
    const setBarRect = useGameState((state) => state.setBlockExpandBarRect);
    const timeOfDay = useGameState((state) => state.timeOfDay);
    const isLocalSandbox = useGameState(
        (state) => state.localSandboxStorageKey !== null,
    );
    const { data: garden } = useCurrentGarden();
    const { data: blockData } = useBlockData();
    const { data: account, isLoading: isAccountLoading } = useCurrentAccount();
    const { data: cart, isLoading: isCartLoading } = useShoppingCart(
        !isLocalSandbox,
    );
    const { track } = useGameAnalytics();

    const [frozen, setFrozen] = useState<FrozenPlan | null>(null);
    const [alert, setAlert] = useState<BlockExpandAlert | null>(initialAlert);

    const isSandbox = Boolean(garden?.isSandbox);
    const plan =
        planResult && planResult.editing === editing ? planResult.plan : null;
    const count = plan?.placements.length ?? 0;

    useEffect(() => {
        if (!editing) {
            return;
        }
        if (session.current?.sequence === editing.sequence) {
            session.current.count = count;
            return;
        }
        session.current = {
            sequence: editing.sequence,
            blockName: editing.blockName,
            count,
            confirmed: false,
        };
    }, [count, editing, session]);

    const blockName = frozen?.blockName ?? editing?.blockName ?? null;
    const block = blockName
        ? blockData?.find(
              (candidate) => candidate.information.name === blockName,
          )
        : undefined;
    const label = block?.information.label ?? blockName ?? '';
    const accountSunflowers = account?.sunflowers.amount;
    // The figure the sunflower HUD shows (OPEN-4).
    const hudBalance =
        typeof accountSunflowers === 'number'
            ? accountSunflowers - (cart?.totalSunflowers ?? 0)
            : null;
    const availability = block
        ? getHudEntityPlacementAvailability({
              accountSunflowers: hudBalance,
              block,
              isAccountLoading,
              isSandbox,
              timeOfDay,
          })
        : null;
    const affordability = resolveExpandAffordability({
        count,
        unitPrice: availability?.sunflowerPrice ?? 0,
        balance: hudBalance,
        isSandbox,
        isAccountLoading:
            isAccountLoading || isCartLoading || !availability || !plan,
        isAvailableNow: availability?.isAvailableNow ?? true,
        isPlaceable: availability?.isPlaceable ?? true,
        pending: editing?.pending,
    });
    const status =
        editing && plan
            ? resolveExpandStatusMessage({
                  affordability,
                  count,
                  width: plan.bounds.width,
                  depth: plan.bounds.depth,
                  maxSide: editing.maxSide,
              })
            : null;
    const canConfirm = affordability.canConfirm && blockedReason === null;
    const visibleAlert =
        editing &&
        alert?.sequence === editing.sequence &&
        isSameCell(alert.corner, editing.corner) &&
        !isExpandAlertInStatus(alert.message, status)
            ? alert.message
            : null;

    async function handleConfirm() {
        const current = store.getState().blockEditing;
        if (
            !editing ||
            current !== editing ||
            current.pending ||
            !plan ||
            !availability ||
            !garden ||
            !canConfirm
        ) {
            return;
        }

        const command: PendingBlockExpand = {
            gardenId: garden.id,
            body: buildBlockExpandRequestBody({
                blockName: current.blockName,
                isSandbox,
                operationId: globalThis.crypto.randomUUID(),
                placements: plan.placements,
                rotation: current.rotation,
                unitPrice: availability.sunflowerPrice,
            }),
        };
        setFrozen({
            blockName: current.blockName,
            width: plan.bounds.width,
            depth: plan.bounds.depth,
            count,
            skippedCount: plan.skippedCount,
            total: affordability.total,
            isSandbox,
        });
        setAlert(null);
        if (session.current?.sequence === current.sequence) {
            session.current.confirmed = true;
        }
        store.getState().setBlockExpandPending(true);
        onConfirmStart();
        track('game_block_expand_confirmed', {
            block_name: current.blockName,
            count,
            skipped_count: plan.skippedCount,
            width: plan.bounds.width,
            depth: plan.bounds.depth,
            total_sunflowers: affordability.total,
            sandbox: isSandbox,
        });

        let result: BlockExpandConfirmResult;
        try {
            const receipt = await confirm({
                command,
                editing: current,
                userId,
            });
            result = {
                kind: 'placed',
                blockName: current.blockName,
                count: receipt.placements.length,
                charged: receipt.chargedSunflowers,
            };
        } catch (error) {
            const failure = resolveBlockExpandFailure(error);
            if (failure.uncertain) {
                result = {
                    kind: 'uncertain',
                    sequence: current.sequence,
                    command,
                };
            } else {
                result = {
                    kind: 'failed',
                    sequence: current.sequence,
                    blockName: current.blockName,
                    count,
                };
                if (session.current?.sequence === current.sequence) {
                    session.current.confirmed = false;
                }
                setAlert({
                    sequence: current.sequence,
                    corner: current.corner,
                    message: failure.message,
                });
            }
        }
        setFrozen(null);
        onConfirmSettled(result);
    }

    let panel: BlockExpandPanelProps | null = null;
    if (frozen) {
        panel = {
            label,
            area: { width: frozen.width, depth: frozen.depth },
            count: frozen.count,
            skippedCount: frozen.skippedCount,
            total: frozen.total,
            // The live HUD figure: it already shows the optimistic debit,
            // as the sunflower HUD does.
            balance: frozen.isSandbox ? null : hudBalance,
            earlier,
            // Closed from outside while placing: the bottom HUD is live.
            liftAboveLiveHud: editing === null,
            actions: {
                kind: 'confirm',
                canConfirm: false,
                pending: true,
                onCancel: () => undefined,
                onConfirm: () => undefined,
            },
        };
    } else if (editing) {
        panel = {
            label,
            area: plan
                ? { width: plan.bounds.width, depth: plan.bounds.depth }
                : null,
            count,
            skippedCount: plan?.skippedCount ?? 0,
            total: affordability.total,
            balance: isSandbox ? null : hudBalance,
            status: blockedReason ?? status,
            alert: visibleAlert,
            earlier,
            actions: {
                kind: 'confirm',
                canConfirm,
                pending: editing.pending,
                onCancel: () => store.getState().closeBlockEditing(),
                onConfirm: () => void handleConfirm(),
            },
        };
    }

    return panel ? (
        <BlockExpandPanel {...panel} onBarRectChange={setBarRect} />
    ) : null;
}
