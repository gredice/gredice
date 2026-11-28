import { Button } from '@gredice/ui/Button';
import { SunflowerText } from '@gredice/ui/SunflowerVisuals';
import { cx } from '@gredice/ui/utils';
import { type MouseEvent, useLayoutEffect, useRef } from 'react';
import {
    BlockOptionsMedallion,
    blockOptionsBarPopClassName,
    blockOptionsCandyClassName,
    blockOptionsChipClassName,
} from '../BlockOptionsArt';
import { blockExpandCopy, formatSunflowerChip } from '../blockOptionsCopy';
import {
    type BlockExpandBarRect,
    useBlockExpandBarLift,
    useBlockExpandBarRectReport,
} from './blockExpandBarPosition';

type BlockExpandRetryActions = {
    /** A request whose response never arrived: check it or drop it. */
    kind: 'retry';
    pending: boolean;
    onDiscard: () => void;
    onRetry: () => void;
};

type BlockExpandCloseActions = {
    /** The receipt, or why nothing was placed. */
    kind: 'close';
    onClose: () => void;
};

export type BlockExpandPanelActions =
    | {
          /** Reviewing a plan: Odustani and Potvrdi postavljanje. */
          kind: 'confirm';
          canConfirm: boolean;
          /** The confirmed plan is being placed (numbers are frozen). */
          pending: boolean;
          onCancel: () => void;
          onConfirm: () => void;
      }
    | BlockExpandRetryActions
    | BlockExpandCloseActions;

/**
 * A stored request shown above a new Expand: checked again or dropped from
 * here, then its receipt (or why nothing was placed) until closed.
 */
export type BlockExpandPanelEarlier = {
    label: string;
    count: number;
    status?: string | null;
    alert?: string | null;
    actions: BlockExpandRetryActions | BlockExpandCloseActions;
};

export type BlockExpandPanelProps = {
    /** Display label of the expanded block. */
    label: string;
    /** Replaces "Proširi: {label}", e.g. on the receipt. */
    title?: string;
    /** The marked rectangle; omitted for a stored request. */
    area?: { width: number; depth: number } | null;
    /**
     * Copies the plan places, or placed (receipt). Null hides the count and
     * the total, as when nothing was placed.
     */
    count: number | null;
    /** Marked cells that get no copy. */
    skippedCount?: number;
    /** Sunflowers for every copy: the plan's total, or what was charged. */
    total: number | null;
    /**
     * The balance the sunflower HUD shows (balance minus the shopping
     * cart). Null or omitted hides the line, as in sandbox gardens.
     */
    balance?: number | null;
    /**
     * The status line: an empty area, the cap, a short balance, … With
     * `close` actions it is the receipt ("Postavljeno: …") in place of the
     * count.
     */
    status?: string | null;
    /** An error from the last request. */
    alert?: string | null;
    /** A stored request offered above this Expand. */
    earlier?: BlockExpandPanelEarlier | null;
    /**
     * The bottom HUD rows are live (no Expand is open, so they are not
     * inert): the bar is measured and lifted above any of them it would
     * cover, as the controls row on phones.
     */
    liftAboveLiveHud?: boolean;
    /**
     * Focus Zatvori when the panel mounts: the receipt of a request sent
     * from the keyboard, so focus does not fall back to the page and the
     * receipt stays until it is closed.
     */
    autoFocusClose?: boolean;
    /** Receives the bar's client rectangle while it is shown (open Expand). */
    onBarRectChange?: (rect: BlockExpandBarRect | null) => void;
    actions: BlockExpandPanelActions;
};

/**
 * Whether keyboard focus is in an Expand bar: a focused element inside one
 * that shows keyboard focus (`:focus-visible`). A mouse or touch press on a
 * button does not show it.
 */
export function hasBlockExpandKeyboardFocus() {
    if (typeof document === 'undefined') {
        return false;
    }

    const active = document.activeElement;
    if (!active?.closest('[data-block-expand-hud]')) {
        return false;
    }

    try {
        return active.matches(':focus-visible');
    } catch {
        return false;
    }
}

/**
 * Runs a bar action from a button that the action disables (Potvrdi,
 * Provjeri isti zahtjev, Odbaci). With keyboard focus on the button, focus
 * moves to the bar first, so it does not fall to the page while the
 * request runs, and an error or the receipt is read from where it was.
 */
function runKeepingKeyboardFocus(
    event: MouseEvent<HTMLButtonElement>,
    action: () => void,
) {
    const region = event.currentTarget.closest<HTMLElement>(
        '[data-block-expand-hud]',
    );
    const keepFocus =
        document.activeElement === event.currentTarget &&
        hasBlockExpandKeyboardFocus();
    action();
    if (keepFocus && region?.isConnected) {
        region.focus({ preventScroll: true });
    }
}

const actionButtonClassName = 'h-11 px-4';

/** A cream candy button: Odustani, Odbaci, Zatvori. */
const secondaryButtonProps = {
    className: blockOptionsCandyClassName(actionButtonClassName),
    'data-tone': 'cream',
    variant: 'plain',
} as const;

/** The green candy button that goes ahead: Potvrdi, Provjeri. */
const primaryButtonProps = {
    className: blockOptionsCandyClassName(actionButtonClassName),
    'data-tone': 'grass',
    variant: 'plain',
} as const;

function BlockExpandSecondaryActions({
    actions,
}: {
    actions: BlockExpandRetryActions | BlockExpandCloseActions;
}) {
    if (actions.kind === 'close') {
        return (
            <div className="grid">
                <Button
                    {...secondaryButtonProps}
                    data-block-expand-action="close"
                    onClick={actions.onClose}
                >
                    {blockExpandCopy.close}
                </Button>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-[auto_1fr] gap-2">
            <Button
                {...secondaryButtonProps}
                disabled={actions.pending}
                onClick={(event) =>
                    runKeepingKeyboardFocus(event, actions.onDiscard)
                }
            >
                {blockExpandCopy.discard}
            </Button>
            <Button
                {...primaryButtonProps}
                disabled={actions.pending}
                onClick={(event) =>
                    runKeepingKeyboardFocus(event, actions.onRetry)
                }
            >
                {actions.pending
                    ? blockExpandCopy.pending
                    : blockExpandCopy.retrySame}
            </Button>
        </div>
    );
}

/**
 * The Expand bar above the bottom HUD (spec §7.6): what the marked area
 * places, what it costs, the HUD balance it is compared with, and the
 * actions for the current step. `BlockExpandHud` decides what it shows; its
 * only state is the measured lift above a live bottom HUD.
 *
 * It is a HUD game card: the Proširi medallion, the total on a sunflower
 * chip and candy buttons. It rises with a small overshoot.
 */
export function BlockExpandPanel({
    actions,
    alert,
    area,
    autoFocusClose = false,
    balance,
    count,
    earlier,
    label,
    liftAboveLiveHud = false,
    onBarRectChange,
    skippedCount = 0,
    status,
    title,
    total,
}: BlockExpandPanelProps) {
    const sectionRef = useRef<HTMLElement>(null);
    const liftedBottom = useBlockExpandBarLift(sectionRef, liftAboveLiveHud);
    useBlockExpandBarRectReport(sectionRef, onBarRectChange ?? null);

    useLayoutEffect(() => {
        if (autoFocusClose) {
            sectionRef.current
                ?.querySelector<HTMLButtonElement>(
                    '[data-block-expand-action="close"]',
                )
                ?.focus({ preventScroll: true });
        }
    }, [autoFocusClose]);
    const receipt = actions.kind === 'close';
    const statusInSummary = receipt && count !== null;
    // The receipt swaps Proširi's medallion for a green check (placed) or a
    // red cross (nothing placed); the key pops the new one in.
    const headerArt = receipt
        ? count !== null
            ? 'confirm'
            : 'cancel'
        : 'expand';
    const details = [
        area ? blockExpandCopy.area(area.width, area.depth) : null,
        !receipt && skippedCount > 0
            ? blockExpandCopy.skipped(skippedCount)
            : null,
    ].filter((detail) => detail !== null);

    return (
        <section
            ref={sectionRef}
            aria-label={blockExpandCopy.region}
            data-block-expand-hud={actions.kind}
            // The entrance only rises and pops: a fade would start fully
            // transparent and the bar would stay invisible until the page
            // draws frames again (a busy device, an idle headless
            // renderer). No transitions: the measured lift must apply
            // before the first paint, not glide up from the default offset
            // over the live HUD.
            className={cx(
                'pointer-events-auto absolute bottom-[calc(var(--game-safe-area-bottom,0px)+5rem)] left-1/2 z-30 w-80 max-w-[calc(100vw-1rem)] -translate-x-1/2 origin-bottom space-y-2 rounded-2xl border-2 border-b-4 border-tertiary bg-background p-3 text-sm shadow-[0_6px_16px_rgb(15_23_42/0.18)] outline-hidden transition-none',
                blockOptionsBarPopClassName,
            )}
            style={liftedBottom !== null ? { bottom: liftedBottom } : undefined}
            // Keeps keyboard focus while a button it pressed is disabled.
            tabIndex={-1}
        >
            {earlier ? (
                <fieldset
                    aria-label={blockExpandCopy.earlierRegion}
                    data-block-expand-earlier={earlier.actions.kind}
                    className="min-w-0 space-y-2 rounded-xl border-2 border-tertiary border-dashed bg-muted/60 p-2 text-xs"
                >
                    <p className="truncate font-medium">
                        {blockExpandCopy.earlierTitle(
                            earlier.label,
                            earlier.count,
                        )}
                    </p>
                    {/* Announced by `BlockExpandHud`'s live region. */}
                    {earlier.status ? <p>{earlier.status}</p> : null}
                    {earlier.alert ? (
                        <p
                            role="alert"
                            className="text-red-700 dark:text-red-300"
                        >
                            {earlier.alert}
                        </p>
                    ) : null}
                    <BlockExpandSecondaryActions actions={earlier.actions} />
                </fieldset>
            ) : null}
            <div className="flex items-center gap-2.5">
                <BlockOptionsMedallion
                    key={headerArt}
                    art={headerArt}
                    pop
                    popIndex="late"
                />
                <div className="min-w-0 space-y-0.5">
                    <p className="truncate font-extrabold">
                        {title ?? blockExpandCopy.title(label)}
                    </p>
                    {details.length > 0 ? (
                        <p className="text-muted-foreground text-xs tabular-nums">
                            {details.join(' · ')}
                        </p>
                    ) : null}
                </div>
            </div>
            {count !== null ? (
                <div className="flex items-center justify-between gap-3">
                    {statusInSummary && status ? (
                        // The receipt; `BlockExpandHud` announces it.
                        <p className="font-bold">{status}</p>
                    ) : (
                        <p
                            aria-live="polite"
                            aria-atomic="true"
                            data-block-expand-count={count}
                            className="min-w-36 font-bold tabular-nums"
                        >
                            {blockExpandCopy.count(count)}
                        </p>
                    )}
                    {total !== null ? (
                        <p className="flex shrink-0 items-center gap-1.5">
                            <span className="text-muted-foreground text-xs">
                                {blockExpandCopy.totalLabel}
                            </span>
                            <span
                                data-block-expand-total={total}
                                className={cx(
                                    blockOptionsChipClassName,
                                    'inline-flex items-center px-2.5 py-0.5 tabular-nums',
                                )}
                            >
                                <SunflowerText>
                                    {formatSunflowerChip(total)}
                                </SunflowerText>
                            </span>
                        </p>
                    ) : null}
                </div>
            ) : null}
            {!receipt && typeof balance === 'number' ? (
                <p
                    data-block-expand-balance={balance}
                    className="text-right text-muted-foreground text-xs tabular-nums"
                >
                    <SunflowerText>{`${blockExpandCopy.balanceLabel} ${formatSunflowerChip(balance)}`}</SunflowerText>
                </p>
            ) : null}
            {/* One message area with its height reserved, so the buttons do
                not jump when a status or an error appears. */}
            <div className="min-h-4 space-y-1 text-xs empty:hidden">
                {statusInSummary ? null : <p role="status">{status ?? ''}</p>}
                {alert ? (
                    <p role="alert" className="text-red-700 dark:text-red-300">
                        {alert}
                    </p>
                ) : null}
            </div>
            {actions.kind === 'confirm' ? (
                <div className="grid grid-cols-[auto_1fr] gap-2">
                    <Button
                        {...secondaryButtonProps}
                        disabled={actions.pending}
                        onClick={actions.onCancel}
                    >
                        {blockExpandCopy.cancel}
                    </Button>
                    <Button
                        {...primaryButtonProps}
                        disabled={!actions.canConfirm || actions.pending}
                        onClick={(event) =>
                            runKeepingKeyboardFocus(event, actions.onConfirm)
                        }
                    >
                        {actions.pending
                            ? blockExpandCopy.pending
                            : blockExpandCopy.confirm}
                    </Button>
                </div>
            ) : (
                <BlockExpandSecondaryActions actions={actions} />
            )}
        </section>
    );
}
