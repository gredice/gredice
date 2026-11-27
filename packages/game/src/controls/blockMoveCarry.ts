/**
 * Carry mode: Pomakni was tapped without dragging, so the lifted block waits
 * for a tap (or a mouse click) on its destination (spec §2.6 E, §6). The
 * pickup session stays open; these helpers decide which next pointer takes
 * it over.
 */

/** HUD and pop-up controls: a press on one cancels the carry and goes through. */
export const carryPointerControlSelector =
    'button, a, input, select, textarea, [role="dialog"], [data-block-options-control]';

/**
 * In-scene overlays that count as the canvas even when they are buttons:
 * animal speech bubbles float over the garden, so a tap on one drops there.
 */
export const carryPointerOverlaySelector = '[data-actor-speech-bubble]';

/** How long after the adopted pointer is released its click may arrive. */
const adoptedClickAfterReleaseMs = 400;
/** Stops waiting for that click if the pointer is never released. */
const adoptedClickSafetyMs = 15_000;

/**
 * A press this soon after the Pomakni release that started the carry, and
 * this close to it, is the second half of a double-click (or double tap) on
 * Pomakni, not the player picking a cell. Double-clicks are taught for
 * rotating blocks, so the gesture is common.
 */
export const carryDoubleClickWindowMs = 500;
export const carryDoubleClickRadiusPx = 32;

/**
 * - `adopt`: the press picks the cell (its release drops there);
 * - `swallow`: the press is the second half of a double-click on Pomakni;
 *   it is stopped and the carry keeps waiting;
 * - `cancel`: the carry ends and the press goes through;
 * - `ignore`: nothing happens (another button or a second finger).
 */
export type CarryPointerDecision = 'adopt' | 'cancel' | 'ignore' | 'swallow';

/** Where and when the Pomakni release that started the carry happened. */
export type CarryStartRelease = {
    clientX: number;
    clientY: number;
    /** `event.timeStamp` (the `performance.now()` clock). */
    timeStamp: number;
};

type CarryPointerTarget = {
    closest(selectors: string): unknown;
};

type CarryPointerRoot<TNode> = {
    contains(other: TNode | null): boolean;
};

/**
 * Whether a `pointerdown` during carry takes over the session:
 * - only the primary button of the primary pointer counts; others are
 *   ignored (no cancel), so a right-click or a second finger does nothing;
 * - a press over the items HUD drop target adopts (it recycles or deletes);
 * - a press inside the r3f root (the event source that holds the canvas
 *   and drei `Html` overlays) adopts, unless it is on a control; animal
 *   speech bubbles are overlays, not controls;
 * - anything else (HUD controls, outside the game) cancels the carry and
 *   is let through;
 * - a press that would adopt but is the second half of a double-click on
 *   Pomakni (`isCarryStartDoubleClick`) is swallowed instead.
 */
export function shouldAdoptCarryPointer<TNode>({
    button,
    isOverHudDropTarget,
    isPrimary,
    isStartDoubleClick = false,
    r3fRoot,
    target,
}: {
    button: number;
    isOverHudDropTarget: boolean;
    isPrimary: boolean;
    /** See `isCarryStartDoubleClick`. */
    isStartDoubleClick?: boolean;
    r3fRoot: CarryPointerRoot<TNode> | null;
    target: (TNode & CarryPointerTarget) | null;
}): CarryPointerDecision {
    if (!isPrimary || button !== 0) {
        return 'ignore';
    }

    const adopt = isStartDoubleClick ? 'swallow' : 'adopt';
    if (isOverHudDropTarget) {
        return adopt;
    }
    if (!target || !r3fRoot?.contains(target)) {
        return 'cancel';
    }
    if (target.closest(carryPointerOverlaySelector)) {
        return adopt;
    }

    return target.closest(carryPointerControlSelector) ? 'cancel' : adopt;
}

/**
 * Whether a press is the second half of a double-click (or double tap) on
 * Pomakni: within `carryDoubleClickWindowMs` of the release that started
 * the carry and `carryDoubleClickRadiusPx` of where it happened. A carry
 * started from the keyboard has no release (`start` null).
 */
export function isCarryStartDoubleClick({
    clientX,
    clientY,
    start,
    timeStamp,
}: {
    clientX: number;
    clientY: number;
    start: CarryStartRelease | null;
    timeStamp: number;
}) {
    if (!start) {
        return false;
    }

    const elapsedMs = timeStamp - start.timeStamp;
    return (
        elapsedMs >= 0 &&
        elapsedMs <= carryDoubleClickWindowMs &&
        Math.hypot(clientX - start.clientX, clientY - start.clientY) <=
            carryDoubleClickRadiusPx
    );
}

/**
 * The element that holds the canvas and every drei `Html` overlay: r3f's
 * event source (`events.connected`), which drei mounts overlays into. It is
 * the parent of the canvas's own container, not the canvas's parent.
 */
export function resolveCarryPointerRoot(
    connected: unknown,
    canvas: HTMLElement,
): HTMLElement | null {
    if (connected instanceof HTMLElement) {
        return connected;
    }

    return canvas.parentElement?.parentElement ?? canvas.parentElement;
}

/**
 * Whether a `pointermove` during carry moves the preview: only a mouse with
 * no button pressed hovers. Touch has no hover, and a moving press is a drag
 * that the adopting `pointerdown` already took over.
 */
export function shouldFollowCarryHover({
    buttons,
    pointerType,
}: {
    buttons: number;
    pointerType: string;
}) {
    return pointerType === 'mouse' && buttons === 0;
}

/**
 * Swallows the click that follows an adopted or swallowed press. An adopted
 * press dropped the block, so an overlay button under it (an animal bubble,
 * the HUD drop target) must not act on it as well; a swallowed press does
 * nothing at all. The listeners remove themselves after that click, shortly
 * after the pointer is released, or after a long wait.
 */
function swallowClickOfPointer(pointerId: number) {
    let timer = window.setTimeout(remove, adoptedClickSafetyMs);

    function remove() {
        window.clearTimeout(timer);
        window.removeEventListener('pointerup', handlePointerUp, {
            capture: true,
        });
        window.removeEventListener('click', handleClick, { capture: true });
    }

    function handlePointerUp(event: PointerEvent) {
        if (event.pointerId !== pointerId) {
            return;
        }

        window.clearTimeout(timer);
        timer = window.setTimeout(remove, adoptedClickAfterReleaseMs);
    }

    function handleClick(event: MouseEvent) {
        // Keyboard activations (detail 0) are not the adopted press.
        if (event.detail === 0) {
            return;
        }

        remove();
        event.stopPropagation();
        event.preventDefault();
    }

    window.addEventListener('pointerup', handlePointerUp, { capture: true });
    window.addEventListener('click', handleClick, { capture: true });
}

/**
 * Listens for the pointer that ends a carry, until uninstalled:
 * - `pointerdown` on `window` in the capture phase, so it runs before r3f's
 *   and the camera's listeners. An adopted or swallowed press is stopped
 *   there (no new hold, no pan) and its click is swallowed; a cancelling
 *   press goes on.
 * - mouse hover `pointermove`s, which move the preview;
 * - Escape on `document`.
 *
 * Every listener does nothing while `isAwaiting()` is false (the carry was
 * adopted or ended). `start` is the Pomakni release that started the carry
 * (null from the keyboard); a press that repeats it as a double-click is
 * swallowed.
 */
export function installCarryPointerAdoption({
    getR3fRoot,
    isAwaiting,
    isOverHudDropTarget,
    onAdopt,
    onCancel,
    onEscape,
    onHover,
    start,
}: {
    getR3fRoot: () => HTMLElement | null;
    isAwaiting: () => boolean;
    isOverHudDropTarget: (clientX: number, clientY: number) => boolean;
    onAdopt: (event: PointerEvent) => void;
    onCancel: (event: PointerEvent) => void;
    onEscape: () => void;
    onHover: (event: PointerEvent) => void;
    start: CarryStartRelease | null;
}) {
    const handlePointerDown = (event: PointerEvent) => {
        if (!isAwaiting()) {
            return;
        }

        const decision = shouldAdoptCarryPointer({
            button: event.button,
            isOverHudDropTarget: isOverHudDropTarget(
                event.clientX,
                event.clientY,
            ),
            isPrimary: event.isPrimary,
            isStartDoubleClick: isCarryStartDoubleClick({
                clientX: event.clientX,
                clientY: event.clientY,
                start,
                timeStamp: event.timeStamp,
            }),
            r3fRoot: getR3fRoot(),
            target: event.target instanceof Element ? event.target : null,
        });
        if (decision === 'ignore') {
            return;
        }
        if (decision === 'cancel') {
            onCancel(event);
            return;
        }

        event.stopPropagation();
        swallowClickOfPointer(event.pointerId);
        if (decision === 'adopt') {
            onAdopt(event);
        }
    };

    const handlePointerMove = (event: PointerEvent) => {
        if (isAwaiting() && shouldFollowCarryHover(event)) {
            onHover(event);
        }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key !== 'Escape' || event.defaultPrevented || !isAwaiting()) {
            return;
        }

        event.preventDefault();
        onEscape();
    };

    window.addEventListener('pointerdown', handlePointerDown, {
        capture: true,
    });
    window.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
        window.removeEventListener('pointerdown', handlePointerDown, {
            capture: true,
        });
        window.removeEventListener('pointermove', handlePointerMove);
        document.removeEventListener('keydown', handleKeyDown);
    };
}
