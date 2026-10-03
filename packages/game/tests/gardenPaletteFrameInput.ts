export type GardenPaletteFrameInputReceipt = {
    rootId: number;
    callbackId: number;
    requestId: number;
    timestamp: number;
};

export function installGardenPaletteFrameInput() {
    type RootBinding = {
        root: object;
        rootId: number;
        callback: FrameRequestCallback;
        callbackId: number;
        timestamp: number;
        rendererFrame: number;
    };
    type PendingFrame = {
        requestId: number;
        callback: FrameRequestCallback;
        requestedAt: number;
    };
    const originalRaf = window.requestAnimationFrame;
    const originalCancel = window.cancelAnimationFrame;
    const bindings = new WeakMap<object, RootBinding>();
    const callbackBindings = new WeakMap<FrameRequestCallback, RootBinding>();
    const callbackIds = new WeakMap<FrameRequestCallback, number>();
    const pending = new Map<number, PendingFrame>();
    const history: Record<string, unknown>[] = [];
    const errors: string[] = [];
    let requestSequence = 0;
    let rootSequence = 0;
    let callbackSequence = 0;
    let active:
        | {
              callback: FrameRequestCallback;
              requestId: number;
              timestamp: number;
          }
        | undefined;
    const record = (kind: string, details: Record<string, unknown>) => {
        try {
            if (history.length < 32768)
                history.push({ kind, at: performance.now(), ...details });
            else if (!errors.includes('Observer history bound reached'))
                errors.push('Observer history bound reached');
        } catch {
            errors.push('Observer history unavailable');
        }
    };
    const fail = (error: unknown) => {
        if (errors.length < 32) errors.push(String(error));
    };
    const observedRaf: typeof originalRaf = function (this: Window, callback) {
        const requestId = ++requestSequence;
        const requestedAt = performance.now();
        const handle = originalRaf.call(
            this,
            function (this: unknown, timestamp) {
                const previous = active;
                active = { callback, requestId, timestamp };
                try {
                    pending.delete(handle);
                    record('deliver', { requestId, timestamp });
                    return callback.call(this, timestamp);
                } finally {
                    active = previous;
                }
            },
        );
        try {
            pending.set(handle, { requestId, callback, requestedAt });
            record('request', { requestId, requestedAt, handle });
        } catch (error) {
            fail(error);
        }
        return handle;
    };
    const observedCancel: typeof originalCancel = function (
        this: Window,
        handle,
    ) {
        const result = originalCancel.call(this, handle);
        try {
            const cancelled = pending.get(handle);
            pending.delete(handle);
            record('cancel', { handle, requestId: cancelled?.requestId });
        } catch (error) {
            fail(error);
        }
        return result;
    };
    window.requestAnimationFrame = observedRaf;
    window.cancelAnimationFrame = observedCancel;
    const observer = {
        bindReceipt(root: object, timestamp: number, rendererFrame: number) {
            try {
                if (!active || active.timestamp !== timestamp) return;
                const existing = bindings.get(root);
                const previousOwner = callbackBindings.get(active.callback);
                if (previousOwner && previousOwner.root !== root) {
                    fail('Native callback is already bound to another root');
                    return;
                }
                if (existing && existing.callback !== active.callback) {
                    fail('Root native callback identity changed');
                    return;
                }
                let callbackId = callbackIds.get(active.callback);
                if (callbackId === undefined) {
                    callbackId = ++callbackSequence;
                    callbackIds.set(active.callback, callbackId);
                }
                const binding: RootBinding = {
                    root,
                    rootId: existing?.rootId ?? ++rootSequence,
                    callback: active.callback,
                    callbackId,
                    timestamp,
                    rendererFrame,
                };
                bindings.set(root, binding);
                callbackBindings.set(active.callback, binding);
                record('receipt', {
                    rootId: binding.rootId,
                    callbackId,
                    requestId: active.requestId,
                    timestamp,
                    rendererFrame,
                });
            } catch (error) {
                fail(error);
            }
        },
        releaseRoot(root: object) {
            const binding = bindings.get(root);
            if (binding) {
                bindings.delete(root);
                if (callbackBindings.get(binding.callback)?.root === root)
                    callbackBindings.delete(binding.callback);
                record('release-root', { rootId: binding.rootId });
            }
        },
        snapshot(root: object) {
            const binding = bindings.get(root);
            if (!binding) return undefined;
            const now = performance.now();
            const dueAt = binding.timestamp + 16;
            const queued = [...pending.entries()]
                .filter(([, entry]) => entry.callback === binding.callback)
                .map(([handle, entry]) => ({
                    handle,
                    requestId: entry.requestId,
                    requestedAt: entry.requestedAt,
                }));
            // This is the fixture's unchanged Playwright16ms display grid,
            // not a production cadence promise or a scheduler calibration.
            const ready =
                errors.length === 0 &&
                queued.length === 1 &&
                queued[0].requestedAt >= binding.timestamp &&
                queued[0].requestedAt < dueAt &&
                now >= queued[0].requestedAt &&
                now < dueAt;
            return {
                rootId: binding.rootId,
                callbackId: binding.callbackId,
                lastTimestamp: binding.timestamp,
                rendererFrame: binding.rendererFrame,
                now,
                dueAt,
                queued,
                ready,
                errors: [...errors],
            };
        },
        activeReceipt(
            root: object,
        ): GardenPaletteFrameInputReceipt | undefined {
            const binding = bindings.get(root);
            if (!binding || !active || active.callback !== binding.callback)
                return undefined;
            return {
                rootId: binding.rootId,
                callbackId: binding.callbackId,
                requestId: active.requestId,
                timestamp: active.timestamp,
            };
        },
        history: () => ({
            events: [...history],
            errors: [...errors],
            bound: 32768,
        }),
        restore() {
            if (window.requestAnimationFrame === observedRaf)
                window.requestAnimationFrame = originalRaf;
            if (window.cancelAnimationFrame === observedCancel)
                window.cancelAnimationFrame = originalCancel;
            pending.clear();
            if (window.gardenPaletteFrameInput === observer)
                delete window.gardenPaletteFrameInput;
            return (
                window.requestAnimationFrame === originalRaf &&
                window.cancelAnimationFrame === originalCancel &&
                window.gardenPaletteFrameInput === undefined
            );
        },
    };
    window.gardenPaletteFrameInput = observer;
}

export type GardenPaletteFrameInputSnapshot = NonNullable<
    ReturnType<NonNullable<Window['gardenPaletteFrameInput']>['snapshot']>
>;

declare global {
    interface Window {
        gardenPaletteFrameInput?: {
            bindReceipt: (
                root: object,
                timestamp: number,
                rendererFrame: number,
            ) => void;
            releaseRoot: (root: object) => void;
            snapshot: (root: object) =>
                | {
                      rootId: number;
                      callbackId: number;
                      lastTimestamp: number;
                      rendererFrame: number;
                      now: number;
                      dueAt: number;
                      queued: {
                          handle: number;
                          requestId: number;
                          requestedAt: number;
                      }[];
                      ready: boolean;
                      errors: string[];
                  }
                | undefined;
            activeReceipt: (
                root: object,
            ) => GardenPaletteFrameInputReceipt | undefined;
            history: () => {
                events: Record<string, unknown>[];
                errors: string[];
                bound: number;
            };
            restore: () => boolean;
        };
    }
}
