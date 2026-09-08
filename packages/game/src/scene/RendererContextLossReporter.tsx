export function subscribeToRendererContextLoss({
    eventTarget,
    onContextLost,
}: {
    eventTarget: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
    onContextLost: () => void;
}) {
    const handleContextLost = () => onContextLost();
    // Report before visibility/cache listeners can synchronously rerender the
    // Canvas. R3F refreshes its imperative ref on rerender, which removes this
    // subscription; a replacement listener misses the event already in flight.
    const options = { capture: true };
    eventTarget.addEventListener(
        'webglcontextlost',
        handleContextLost,
        options,
    );
    return () =>
        eventTarget.removeEventListener(
            'webglcontextlost',
            handleContextLost,
            options,
        );
}
