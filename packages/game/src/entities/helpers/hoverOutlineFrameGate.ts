type HoverOutlineFrameConsumer = {
    consumeRenderedFrame: () => boolean;
    release: () => void;
};

/**
 * Keeps a global R3F after-effect scoped to frames rendered by one Canvas root.
 * Each effect registration owns a generation so a stale StrictMode callback
 * cannot consume a token that belongs to its replacement.
 */
export function createHoverOutlineFrameGate() {
    let activeConsumer: symbol | null = null;
    let renderedFramePending = false;

    return {
        markRenderedFrame: () => {
            renderedFramePending = true;
        },
        registerConsumer: (): HoverOutlineFrameConsumer => {
            const consumer = Symbol('hover-outline-frame-consumer');
            activeConsumer = consumer;
            renderedFramePending = false;

            return {
                consumeRenderedFrame: () => {
                    if (activeConsumer !== consumer || !renderedFramePending) {
                        return false;
                    }

                    renderedFramePending = false;
                    return true;
                },
                release: () => {
                    if (activeConsumer !== consumer) {
                        return;
                    }

                    activeConsumer = null;
                    renderedFramePending = false;
                },
            };
        },
    };
}
