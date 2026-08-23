export function subscribeToRendererContextLoss({
    eventTarget,
    onContextLost,
}: {
    eventTarget: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
    onContextLost: () => void;
}) {
    const handleContextLost = () => onContextLost();
    eventTarget.addEventListener('webglcontextlost', handleContextLost);
    return () =>
        eventTarget.removeEventListener('webglcontextlost', handleContextLost);
}
