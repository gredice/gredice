'use client';

import { Button } from '@gredice/ui/Button';
import { cx } from '@gredice/ui/utils';
import {
    type CSSProperties,
    type KeyboardEvent,
    type PointerEvent,
    type Ref,
    type SyntheticEvent,
    useCallback,
    useLayoutEffect,
    useRef,
    useState,
} from 'react';
import {
    BlockOptionsBurst,
    BlockOptionsMedallion,
    blockOptionsTileClassName,
} from './BlockOptionsArt';
import type {
    BlockOptionsAction,
    BlockOptionsActionId,
} from './blockOptionsActions';
import { getBlockOptionsActionArt } from './blockOptionsArtwork';
import { blockOptionsToolbarCopy } from './blockOptionsCopy';
import type { BlockOptionsPopupSide } from './popupPosition';

export type BlockOptionsToolbarStatus = {
    /** `status` explains a disabled tile; `alert` reports a failed action. */
    kind: 'status' | 'alert';
    message: string;
};

export type BlockOptionsToolbarProps = {
    /** The block's display label, for the toolbar's accessible name. */
    label: string;
    actions: readonly BlockOptionsAction[];
    status?: BlockOptionsToolbarStatus | null;
    /** Kept in the page but hidden while a move it started is running. */
    hidden?: boolean;
    /**
     * Side of the block the bubble is on, and where its tail meets that
     * side. The pop-up layer updates both on the element while the camera
     * moves; these set the starting values (and the stories' values).
     */
    side?: BlockOptionsPopupSide;
    tailOffset?: number;
    /** A tile was activated; `keyboard` when Enter or Space pressed it. */
    onAction?: (id: BlockOptionsActionId, input: { keyboard: boolean }) => void;
    /** Pomakni was pressed: starts a move that can continue as a drag. */
    onMovePointerDown?: (event: PointerEvent<HTMLButtonElement>) => void;
    ref?: Ref<HTMLDivElement>;
};

const popIndices = [0, 1, 2, 3] as const;

/** CSS variable with the tail's offset along the facing side. */
export const blockOptionsTailOffsetProperty = '--block-options-tail';

const toolbarNavigationKeys = new Set([
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
    'Home',
    'End',
]);

// Compact tiles (spec D17): a candy medallion with the action's game
// artwork above a short label, at least 44 px tall. The medallion bounces
// on hover and presses down, so the tile itself has no hover fill.
// `aria-disabled` tiles stay pressable so a tap can show the reason; the
// override wins over the shared Button's `pointer-events-none`.
const tileClassName =
    'h-auto min-h-11 min-w-16 flex-col gap-1 rounded-xl px-1 pt-1 pb-0.5 text-xs font-bold text-foreground hover:bg-transparent active:bg-transparent aria-disabled:pointer-events-auto aria-disabled:opacity-60';

function stopPropagation(event: SyntheticEvent) {
    event.stopPropagation();
}

/**
 * A mouse or touch press must not focus a tile: focus inside the toolbar
 * would take the arrow keys from the camera (and move a focus ring onto the
 * next tile) after Okreni keeps the pop-up open. The press still clicks;
 * keyboard focus and activation are unchanged.
 */
function preventPointerFocus(event: SyntheticEvent) {
    event.preventDefault();
}

/**
 * Pomakni's own move and release must reach the window, where the move
 * session listens; everything else stays inside the bubble so the scene
 * behind it does not react.
 */
function stopUnlessFromMoveTile(event: SyntheticEvent) {
    if (
        event.target instanceof Element &&
        event.target.closest('[data-block-options-action="move"]')
    ) {
        return;
    }
    event.stopPropagation();
}

/**
 * The block options pop-up (spec §3.3): a speech bubble with one row of
 * four tiles (Proširi, Okreni, Recikliraj or Obriši, Pomakni) and a status
 * line for the reason a tile is unavailable or an action failed. It only
 * renders what it is given; `BlockOptionsPopupLayer` places it next to the
 * block and runs the actions.
 *
 * It is a HUD game card: cream with a chunky rim, its tiles candy
 * medallions with the generated artwork. It pops out of its tail with a
 * confetti burst at the block, and the medallions bounce in one after
 * another; under reduced motion it only fades in.
 */
export function BlockOptionsToolbar({
    actions,
    hidden = false,
    label,
    onAction,
    onMovePointerDown,
    ref,
    side = 'above',
    status = null,
    tailOffset,
}: BlockOptionsToolbarProps) {
    const [focusIndex, setFocusIndex] = useState(0);
    const rootRef = useRef<HTMLDivElement | null>(null);
    const style: CSSProperties & Record<string, string> = {};
    if (tailOffset !== undefined) {
        style[blockOptionsTailOffsetProperty] = `${tailOffset}px`;
    }

    // Focus that was inside the toolbar goes back to the page when it
    // closes, so the camera's keyboard controls keep working.
    useLayoutEffect(() => {
        const root = rootRef.current;
        return () => {
            const active = document.activeElement;
            if (
                root &&
                active instanceof HTMLElement &&
                root.contains(active)
            ) {
                active.blur();
            }
        };
    }, []);

    const setRootRef = useCallback(
        (node: HTMLDivElement) => {
            rootRef.current = node;
            let detach: (() => void) | undefined;
            if (typeof ref === 'function') {
                const cleanup = ref(node);
                detach =
                    typeof cleanup === 'function' ? cleanup : () => ref(null);
            } else if (ref) {
                ref.current = node;
                detach = () => {
                    ref.current = null;
                };
            }
            return () => {
                rootRef.current = null;
                detach?.();
            };
        },
        [ref],
    );

    function focusTile(index: number) {
        const count = actions.length;
        if (count === 0) {
            return;
        }
        const next = ((index % count) + count) % count;
        setFocusIndex(next);
        rootRef.current
            ?.querySelectorAll<HTMLButtonElement>('[data-block-options-action]')
            [next]?.focus();
    }

    function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        if (!toolbarNavigationKeys.has(event.key)) {
            return;
        }

        // The camera pans with arrow keys on `document`; inside the toolbar
        // they move between tiles instead.
        event.preventDefault();
        event.stopPropagation();
        if (event.key === 'ArrowRight') {
            focusTile(focusIndex + 1);
        } else if (event.key === 'ArrowLeft') {
            focusTile(focusIndex - 1);
        } else if (event.key === 'Home') {
            focusTile(0);
        } else if (event.key === 'End') {
            focusTile(actions.length - 1);
        }
    }

    return (
        // biome-ignore lint/a11y/noStaticElementInteractions: the bubble only keeps pointer, click and wheel events from reaching the scene behind it; its controls are the toolbar's buttons.
        // biome-ignore lint/a11y/useKeyWithClickEvents: no click action here, only stopPropagation; the buttons handle the keyboard.
        <div
            ref={setRootRef}
            className={cx(
                'group/block-options relative w-max rounded-2xl border-2 border-b-4 border-tertiary bg-background p-1.5 text-foreground shadow-[0_6px_16px_rgb(15_23_42/0.18)]',
                // A playful pop with a small overshoot; a plain fade when
                // the player prefers reduced motion.
                'animate-in fade-in-0 duration-200 motion-safe:zoom-in-50 motion-safe:duration-[350ms] motion-safe:ease-[cubic-bezier(0.34,1.8,0.64,1)]',
                'data-[side=above]:origin-[var(--block-options-tail,50%)_100%] data-[side=below]:origin-[var(--block-options-tail,50%)_0%] data-[side=left]:origin-[100%_var(--block-options-tail,50%)] data-[side=right]:origin-[0%_var(--block-options-tail,50%)]',
                hidden && 'pointer-events-none invisible',
            )}
            data-block-options-control
            data-block-options-popup
            data-side={side}
            onClick={stopPropagation}
            onDoubleClick={stopPropagation}
            onPointerDown={stopPropagation}
            onPointerMove={stopUnlessFromMoveTile}
            onPointerUp={stopUnlessFromMoveTile}
            onWheel={stopPropagation}
            style={style}
        >
            <div
                aria-label={blockOptionsToolbarCopy.toolbarLabel(label)}
                aria-orientation="horizontal"
                className="flex gap-1"
                onKeyDown={handleKeyDown}
                role="toolbar"
            >
                {actions.map((action, index) => {
                    const disabled = action.disabledReason !== null;
                    const isMove = action.id === 'move';
                    return (
                        <Button
                            key={action.id}
                            aria-disabled={disabled || undefined}
                            className={cx(
                                tileClassName,
                                blockOptionsTileClassName,
                                isMove && 'touch-none',
                            )}
                            data-block-options-action={action.id}
                            onClick={(event) =>
                                onAction?.(action.id, {
                                    keyboard: event.detail === 0,
                                })
                            }
                            onFocus={() => setFocusIndex(index)}
                            onMouseDown={preventPointerFocus}
                            onPointerDown={
                                isMove ? onMovePointerDown : undefined
                            }
                            size="sm"
                            tabIndex={index === focusIndex ? 0 : -1}
                            type="button"
                            variant="plain"
                        >
                            <BlockOptionsMedallion
                                art={getBlockOptionsActionArt(action)}
                                pop
                                popIndex={popIndices[index] ?? 3}
                            />
                            <span
                                className="whitespace-nowrap leading-4"
                                data-block-options-label
                            >
                                {action.label}
                            </span>
                            {disabled ? (
                                <span className="sr-only">
                                    – {action.disabledReason}
                                </span>
                            ) : null}
                        </Button>
                    );
                })}
            </div>
            <div className="mt-0.5 min-h-4 w-0 min-w-full px-1 text-center text-xs leading-4">
                <p
                    className="text-muted-foreground"
                    data-block-options-status
                    role="status"
                >
                    {status?.kind === 'status' ? status.message : null}
                </p>
                <p
                    className="font-bold text-red-700 dark:text-red-300"
                    data-block-options-alert
                    role="alert"
                >
                    {status?.kind === 'alert' ? status.message : null}
                </p>
            </div>
            <svg
                aria-hidden="true"
                className={cx(
                    'pointer-events-none absolute h-2.5 w-5 overflow-visible',
                    'group-data-[side=above]/block-options:top-full group-data-[side=above]/block-options:left-[var(--block-options-tail,50%)] group-data-[side=above]/block-options:-translate-x-1/2',
                    'group-data-[side=below]/block-options:bottom-full group-data-[side=below]/block-options:left-[var(--block-options-tail,50%)] group-data-[side=below]/block-options:-translate-x-1/2 group-data-[side=below]/block-options:rotate-180',
                    'group-data-[side=right]/block-options:left-0 group-data-[side=right]/block-options:top-[var(--block-options-tail,50%)] group-data-[side=right]/block-options:-translate-x-[15px] group-data-[side=right]/block-options:-translate-y-1/2 group-data-[side=right]/block-options:rotate-90',
                    'group-data-[side=left]/block-options:right-0 group-data-[side=left]/block-options:top-[var(--block-options-tail,50%)] group-data-[side=left]/block-options:translate-x-[15px] group-data-[side=left]/block-options:-translate-y-1/2 group-data-[side=left]/block-options:-rotate-90',
                )}
                data-block-options-tail
                viewBox="0 0 20 10"
            >
                <path
                    className="fill-background stroke-tertiary"
                    d="M1 0.5h18L10 9.5Z"
                    strokeLinejoin="round"
                    strokeWidth={2}
                />
            </svg>
            <BlockOptionsBurst
                className={cx(
                    'group-data-[side=above]/block-options:top-[calc(100%+0.625rem)] group-data-[side=above]/block-options:left-[var(--block-options-tail,50%)]',
                    'group-data-[side=below]/block-options:bottom-[calc(100%+0.625rem)] group-data-[side=below]/block-options:left-[var(--block-options-tail,50%)]',
                    'group-data-[side=right]/block-options:-left-2.5 group-data-[side=right]/block-options:top-[var(--block-options-tail,50%)]',
                    'group-data-[side=left]/block-options:-right-2.5 group-data-[side=left]/block-options:top-[var(--block-options-tail,50%)]',
                )}
            />
        </div>
    );
}
