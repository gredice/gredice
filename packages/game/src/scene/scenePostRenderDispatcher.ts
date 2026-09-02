export type ScenePostRenderListener = (timestampMs: number) => void;

type ScenePostRenderDispatcherOptions = {
    recordFrameReceipt: (timestampMs: number) => boolean;
};

type ListenerRegistration = {
    listener: ScenePostRenderListener;
    token: symbol;
};

function subscribeListener(
    listeners: Map<symbol, ScenePostRenderListener>,
    listener: ScenePostRenderListener,
) {
    const registration: ListenerRegistration = {
        listener,
        token: Symbol('scene-post-render-listener'),
    };
    listeners.set(registration.token, registration.listener);
    let released = false;

    return () => {
        if (released) {
            return;
        }
        released = true;
        listeners.delete(registration.token);
    };
}

/**
 * Owns the post-render boundary for one R3F root. A rendered-frame token is
 * consumed exactly once: root-local after-render work runs first, then the
 * scheduler receipt is recorded, and finally receipt observers are notified.
 */
export function createScenePostRenderDispatcher({
    recordFrameReceipt,
}: ScenePostRenderDispatcherOptions) {
    const afterRenderListeners = new Map<symbol, ScenePostRenderListener>();
    const frameReceiptListeners = new Map<symbol, ScenePostRenderListener>();
    let renderedFramePending = false;

    const clearRenderedFrame = () => {
        renderedFramePending = false;
    };
    const flushRenderedFrame = (timestampMs: number) => {
        if (!renderedFramePending) {
            return false;
        }

        renderedFramePending = false;
        try {
            for (const listener of [...afterRenderListeners.values()]) {
                listener(timestampMs);
            }
        } finally {
            if (recordFrameReceipt(timestampMs)) {
                for (const listener of [...frameReceiptListeners.values()]) {
                    listener(timestampMs);
                }
            }
        }
        return true;
    };

    return {
        clearRenderedFrame,
        flushRenderedFrame,
        hasRenderedFramePending: () => renderedFramePending,
        markRenderedFrame: () => {
            renderedFramePending = true;
        },
        subscribeAfterRender: (listener: ScenePostRenderListener) =>
            subscribeListener(afterRenderListeners, listener),
        subscribeFrameReceipt: (listener: ScenePostRenderListener) =>
            subscribeListener(frameReceiptListeners, listener),
    };
}
