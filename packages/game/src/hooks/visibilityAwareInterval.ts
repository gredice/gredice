export class VisibilityAwareInterval {
    private disposed = false;
    private documentVisible: boolean;
    private handle: unknown;
    private intervalScheduled = false;
    private readonly options: {
        clearInterval: (handle: unknown) => void;
        intervalMs: number;
        setInterval: (callback: () => void, intervalMs: number) => unknown;
        tick: () => void;
    };
    private runtimeActive: boolean;

    constructor({
        documentVisible,
        runtimeActive,
        ...options
    }: {
        clearInterval: (handle: unknown) => void;
        documentVisible: boolean;
        intervalMs: number;
        runtimeActive: boolean;
        setInterval: (callback: () => void, intervalMs: number) => unknown;
        tick: () => void;
    }) {
        this.documentVisible = documentVisible;
        this.options = options;
        this.runtimeActive = runtimeActive;
        this.reconcile();
    }

    setDocumentVisible(visible: boolean) {
        if (this.disposed || this.documentVisible === visible) {
            return;
        }
        this.documentVisible = visible;
        this.reconcile();
    }

    setRuntimeActive(active: boolean) {
        if (this.disposed || this.runtimeActive === active) {
            return;
        }
        this.runtimeActive = active;
        this.reconcile();
    }

    dispose() {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        this.clear();
        this.documentVisible = false;
        this.runtimeActive = false;
    }

    private reconcile() {
        if (!this.documentVisible || !this.runtimeActive) {
            this.clear();
            return;
        }
        if (this.intervalScheduled) {
            return;
        }
        this.intervalScheduled = true;
        this.handle = this.options.setInterval(() => {
            if (!this.disposed && this.documentVisible && this.runtimeActive) {
                this.options.tick();
            }
        }, this.options.intervalMs);
    }

    private clear() {
        if (!this.intervalScheduled) {
            return;
        }
        this.options.clearInterval(this.handle);
        this.handle = undefined;
        this.intervalScheduled = false;
    }
}
