'use client';

import { useIsMutating } from '@tanstack/react-query';
import {
    lazy,
    type ReactNode,
    Suspense,
    useEffect,
    useRef,
    useState,
} from 'react';
import { useGameAnalytics } from '../../analytics/GameAnalyticsContext';
import { useBlockData } from '../../hooks/useBlockData';
import { useBlockPlaceBatch } from '../../hooks/useBlockPlaceBatch';
import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useGameState, useGameStateStore } from '../../useGameState';
import { blockPlaceBatchMutationKey } from '../blockEditingState';
import { blockExpandCopy } from '../blockOptionsCopy';
import type {
    BlockExpandAlert,
    BlockExpandConfirmResult,
    BlockExpandSession,
} from './BlockExpandEditor';
import {
    BlockExpandPanel,
    type BlockExpandPanelEarlier,
    type BlockExpandPanelProps,
    hasBlockExpandKeyboardFocus,
} from './BlockExpandPanel';
import { resolveBlockExpandFailure } from './blockExpandRequest';
import {
    type PendingBlockExpand,
    readPendingBlockExpand,
    savePendingBlockExpand,
} from './pendingBlockExpand';

// The editor plans against the garden, and the planner imports the 3D entity
// modules. `GameHud` also mounts this bar in the 2D overview, which must not
// bundle three (`gardenOverview2DBundleBoundary.unit.ts`), so the editor is
// loaded only once an Expand opens (always in 3D, where it is bundled anyway).
const BlockExpandEditor = lazy(() =>
    import('./BlockExpandEditor').then((module) => ({
        default: module.BlockExpandEditor,
    })),
);

/** The receipt closes itself after this long unless it has focus. */
const receiptAutoCloseMs = 3000;

/**
 * A receipt, or why a request placed nothing, for a request that no open
 * Expand explains: shown on its own after Expand closed, or above a new
 * Expand.
 */
type Notice = {
    blockName: string;
    /** Copies placed, or requested when nothing was placed. */
    count: number;
    /** Sunflowers charged; null when nothing was placed. */
    total: number | null;
    status: string | null;
    alert: string | null;
    /**
     * The request was sent from the keyboard: the receipt takes focus on
     * its own (on Zatvori), so focus does not fall to the page.
     */
    focusClose: boolean;
};

/**
 * The Expand bar (spec §7.6–§7.7), mounted by `BlockOptionsHud` in every
 * HUD view. In order of priority it shows:
 *
 * - `BlockExpandEditor` while an unlocked Expand is open or a confirmed
 *   plan is being placed. A stored request is offered above it ("Provjeri
 *   isti zahtjev", "Odbaci", then its receipt), and Potvrdi waits until that
 *   request is resolved, because only one request is stored per garden;
 * - a request whose response never arrived (also after a reload), while its
 *   own Expand stays locked or none is open: "Provjeri isti zahtjev" sends
 *   it again with the same `operationId`, "Odbaci" drops it;
 * - the receipt, or why nothing was placed, after Expand closed.
 *
 * With no Expand open the bottom HUD rows are live, so the bar is lifted
 * above any of them it would cover (the controls row on phones).
 *
 * A live region that never unmounts announces receipts and a lost check,
 * because a status that appears together with its text (a new panel) is
 * not announced reliably.
 */
export function BlockExpandHud() {
    const store = useGameStateStore();
    const editing = useGameState((state) =>
        state.blockEditing?.mode === 'expand' ? state.blockEditing : null,
    );
    const isLocalSandbox = useGameState(
        (state) => state.localSandboxStorageKey !== null,
    );
    const { data: garden } = useCurrentGarden();
    const { data: blockData } = useBlockData();
    const { data: currentUser } = useCurrentUser(!isLocalSandbox);
    const batch = useBlockPlaceBatch();
    const batchInFlight =
        useIsMutating({ mutationKey: blockPlaceBatchMutationKey }) > 0;
    const { track } = useGameAnalytics();

    const [confirmInFlight, setConfirmInFlight] = useState(false);
    const [notice, setNotice] = useState<Notice | null>(null);
    const [recovery, setRecovery] = useState<PendingBlockExpand | null>(null);
    // The Expand that sent the stored request (null after a reload): it
    // keeps the retry bar, also while the hook unlocks it on an answer.
    const [recoveryOrigin, setRecoveryOrigin] = useState<number | null>(null);
    // Why checking a lost request again failed, for the Expand it unlocked.
    const [retryAlert, setRetryAlert] = useState<BlockExpandAlert | null>(null);
    // The last check of the stored request was lost too.
    const [retryLost, setRetryLost] = useState(false);
    const sessionRef = useRef<BlockExpandSession | null>(null);
    // Potvrdi was pressed from the keyboard (see `Notice.focusClose`).
    const keyboardConfirmRef = useRef(false);

    const userId = currentUser?.id ?? null;
    const gardenId = garden?.id ?? null;
    const editingSequence = editing?.sequence ?? null;

    // A request that never got its response survives a reload of the tab.
    // One this page is still sending is not lost (its answer decides), so
    // the stored copy is read again only once no batch is in flight: an
    // uncertain answer leaves it stored, any other answer removes it.
    useEffect(() => {
        if (gardenId === null || batchInFlight) {
            return;
        }

        setRecovery((current) => {
            const stored =
                !isLocalSandbox && userId
                    ? readPendingBlockExpand(userId, gardenId)
                    : null;
            return stored ?? (current?.gardenId === gardenId ? current : null);
        });
    }, [batchInFlight, gardenId, isLocalSandbox, userId]);

    // A new Expand replaces an old receipt.
    useEffect(() => {
        if (editingSequence !== null) {
            setNotice(null);
        }
    }, [editingSequence]);

    // Escape, Odustani or an interruption ended an Expand that was not
    // confirmed. The editor keeps the session's count up to date.
    useEffect(() => {
        if (editingSequence !== null) {
            return;
        }

        const session = sessionRef.current;
        sessionRef.current = null;
        if (session && !session.confirmed) {
            track('game_block_expand_cancelled', {
                block_name: session.blockName,
                count: session.count,
            });
        }
    }, [editingSequence, track]);

    useEffect(() => {
        if (!notice || notice.alert) {
            return;
        }

        const timeoutId = window.setTimeout(() => {
            // On its own or above a new Expand.
            const focused = document.activeElement?.closest(
                '[data-block-expand-hud="close"], [data-block-expand-earlier]',
            );
            if (!focused) {
                setNotice((current) => (current === notice ? null : current));
            }
        }, receiptAutoCloseMs);
        return () => window.clearTimeout(timeoutId);
    }, [notice]);

    function handleConfirmSettled(result: BlockExpandConfirmResult) {
        setConfirmInFlight(false);
        const focusClose = keyboardConfirmRef.current;
        keyboardConfirmRef.current = false;
        if (result.kind === 'placed') {
            setRecovery(null);
            setRetryLost(false);
            setNotice({
                blockName: result.blockName,
                count: result.count,
                total: result.charged,
                status: blockExpandCopy.success(result.count),
                alert: null,
                focusClose,
            });
        } else if (result.kind === 'uncertain') {
            setRecovery(result.command);
            setRecoveryOrigin(result.sequence);
            setRetryLost(false);
        } else {
            // The editor shows why while its Expand is open; one closed
            // from outside (the 2D switch, a garden change) cannot.
            const current = store.getState().blockEditing;
            if (
                current?.mode !== 'expand' ||
                current.sequence !== result.sequence
            ) {
                setNotice({
                    blockName: result.blockName,
                    count: result.count,
                    total: null,
                    status: null,
                    alert: blockExpandCopy.notPlaced,
                    focusClose,
                });
            }
        }
    }

    async function handleRetry() {
        if (!recovery || batch.isPending) {
            return;
        }

        const command = recovery;
        try {
            const receipt = await batch.retry({ command, userId });
            setRecovery(null);
            setRetryAlert(null);
            setRetryLost(false);
            // The bar that sent it keeps focus (`BlockExpandPanel`).
            setNotice({
                blockName: command.body.blockName,
                count: receipt.placements.length,
                total: receipt.chargedSunflowers,
                status: blockExpandCopy.success(receipt.placements.length),
                alert: null,
                focusClose: false,
            });
        } catch (error) {
            const failure = resolveBlockExpandFailure(error);
            if (failure.uncertain) {
                setRetryLost(true);
                return;
            }

            // Nothing was placed.
            setRecovery(null);
            setRetryLost(false);
            // The Expand that sent it (unlocked by the hook) shows its live
            // plan with the reason; a new Expand opened since only gets the
            // outcome above its own plan.
            const current = store.getState().blockEditing;
            if (
                current?.mode === 'expand' &&
                current.sequence === recoveryOrigin
            ) {
                if (sessionRef.current?.sequence === current.sequence) {
                    sessionRef.current.confirmed = false;
                }
                setRetryAlert({
                    sequence: current.sequence,
                    corner: current.corner,
                    message: failure.message,
                });
                return;
            }
            setNotice({
                blockName: command.body.blockName,
                count: command.body.placements.length,
                total: null,
                status: null,
                alert: blockExpandCopy.notPlaced,
                focusClose: false,
            });
        }
    }

    function handleDiscard() {
        if (!recovery || batch.isPending) {
            return;
        }

        if (userId && !isLocalSandbox) {
            savePendingBlockExpand(userId, recovery.gardenId, null);
        }
        setRecovery(null);
        setRetryAlert(null);
        setRetryLost(false);
        const current = store.getState().blockEditing;
        if (current?.mode === 'expand' && current.pending) {
            if (sessionRef.current?.sequence === current.sequence) {
                sessionRef.current.confirmed = false;
            }
            store.getState().setBlockExpandPending(false);
        }
    }

    function labelOf(blockName: string) {
        return (
            blockData?.find((block) => block.information.name === blockName)
                ?.information.label ?? blockName
        );
    }

    const storedRequest =
        recovery && recovery.gardenId === gardenId ? recovery : null;
    const retryActions: BlockExpandPanelEarlier['actions'] = {
        kind: 'retry',
        pending: batch.isPending,
        onDiscard: handleDiscard,
        onRetry: () => void handleRetry(),
    };
    const closeNotice = () => setNotice(null);

    // A stored request keeps the bar while its own Expand is open (locked,
    // or just unlocked by an answer), while any Expand is locked, and when
    // none is open; a new Expand shows its own plan with the request above.
    const showRecovery =
        storedRequest !== null &&
        !confirmInFlight &&
        (!editing || editing.pending || editing.sequence === recoveryOrigin);
    if ((editing || confirmInFlight) && !showRecovery) {
        let earlier: BlockExpandPanelEarlier | null = null;
        if (storedRequest) {
            earlier = {
                label: labelOf(storedRequest.body.blockName),
                count: storedRequest.body.placements.length,
                status: retryLost ? blockExpandCopy.stillUncertain : null,
                alert: blockExpandCopy.uncertain,
                actions: retryActions,
            };
        } else if (notice) {
            earlier = {
                label: labelOf(notice.blockName),
                count: notice.count,
                status: notice.status,
                alert: notice.alert,
                actions: { kind: 'close', onClose: closeNotice },
            };
        }

        return withAnnouncer(
            <Suspense fallback={null}>
                <BlockExpandEditor
                    blockedReason={
                        storedRequest ? blockExpandCopy.earlierPending : null
                    }
                    confirm={batch.confirm}
                    earlier={earlier}
                    initialAlert={retryAlert}
                    onConfirmSettled={handleConfirmSettled}
                    onConfirmStart={() => {
                        keyboardConfirmRef.current =
                            hasBlockExpandKeyboardFocus();
                        setRetryAlert(null);
                        setNotice(null);
                        setConfirmInFlight(true);
                    }}
                    session={sessionRef}
                    userId={userId}
                />
            </Suspense>,
            // A stored request above the plan, else the receipt above it.
            storedRequest
                ? retryLost
                    ? blockExpandCopy.stillUncertain
                    : ''
                : (notice?.status ?? ''),
        );
    }

    let panel: BlockExpandPanelProps | null = null;
    if (storedRequest && showRecovery) {
        const count = storedRequest.body.placements.length;
        panel = {
            label: labelOf(storedRequest.body.blockName),
            count,
            total: storedRequest.body.expectedUnitPrice * count,
            status: retryLost ? blockExpandCopy.stillUncertain : null,
            alert: blockExpandCopy.uncertain,
            actions: retryActions,
        };
    } else if (notice) {
        const placed = notice.total !== null;
        panel = {
            label: labelOf(notice.blockName),
            title: blockExpandCopy.receiptTitle(labelOf(notice.blockName)),
            count: placed ? notice.count : null,
            total: notice.total,
            status: notice.status,
            alert: notice.alert,
            autoFocusClose: notice.focusClose,
            actions: { kind: 'close', onClose: closeNotice },
        };
    }

    return withAnnouncer(
        panel ? (
            <BlockExpandPanel {...panel} liftAboveLiveHud={editing === null} />
        ) : null,
        // The retry bar's own status line announces a lost check; the
        // receipt is announced here.
        storedRequest && showRecovery ? '' : (notice?.status ?? ''),
    );
}

/**
 * The bar, then a live region at a fixed place that never unmounts, so its
 * text is announced however the bar above it changes.
 */
function withAnnouncer(bar: ReactNode, announcement: string) {
    return (
        <>
            {bar}
            <p className="sr-only" data-block-expand-announcer role="status">
                {announcement}
            </p>
        </>
    );
}
