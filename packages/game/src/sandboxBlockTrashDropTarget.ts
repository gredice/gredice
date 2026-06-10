export const sandboxBlockTrashDropTargetAttribute =
    'data-sandbox-block-trash-drop-target';

export const sandboxBlockTrashDropTargetSelector = `[${sandboxBlockTrashDropTargetAttribute}="true"]`;

export function isPointOverSandboxBlockTrashDropTarget(
    clientX: number,
    clientY: number,
) {
    const target = document.querySelector<HTMLElement>(
        sandboxBlockTrashDropTargetSelector,
    );
    if (!target) {
        return false;
    }

    const rect = target.getBoundingClientRect();
    return (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
    );
}
