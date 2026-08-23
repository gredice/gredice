export const itemsHudDropTargetAttribute = 'data-items-hud-drop-target';
export const itemsHudDropTargetActiveAttribute =
    'data-items-hud-drop-target-active';
export const itemsHudDropTargetSelector = `[${itemsHudDropTargetAttribute}="true"]`;

export function isPointWithinClientRect(
    rect: Pick<DOMRect, 'bottom' | 'left' | 'right' | 'top'>,
    clientX: number,
    clientY: number,
) {
    return (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
    );
}

export function isPointOverItemsHudDropTarget(
    clientX: number,
    clientY: number,
) {
    const target = document.querySelector<HTMLElement>(
        itemsHudDropTargetSelector,
    );
    if (!target) {
        return false;
    }

    return isPointWithinClientRect(
        target.getBoundingClientRect(),
        clientX,
        clientY,
    );
}
