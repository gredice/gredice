export type MutationLocatorObserver<TTarget> = {
    disconnect: () => void;
    observe: (
        target: TTarget,
        options: { childList: true; subtree: true },
    ) => void;
};

export class VisibilityAwareMutationLocator<TTarget> {
    private disposed = false;
    private documentVisible: boolean;
    private observerActive = false;
    private readonly observer: MutationLocatorObserver<TTarget>;
    private readonly options: {
        locate: () => boolean;
        observeTarget: TTarget;
    };
    private runtimeActive: boolean;

    constructor({
        createObserver,
        documentVisible,
        runtimeActive,
        ...options
    }: {
        createObserver: (
            onMutation: () => void,
        ) => MutationLocatorObserver<TTarget>;
        documentVisible: boolean;
        locate: () => boolean;
        observeTarget: TTarget;
        runtimeActive: boolean;
    }) {
        this.documentVisible = documentVisible;
        this.options = options;
        this.runtimeActive = runtimeActive;
        this.observer = createObserver(() => this.refresh());
        this.reconcile();
    }

    refresh() {
        if (!this.shouldLocate()) {
            return;
        }
        if (this.options.locate()) {
            this.disconnectObserver();
            return;
        }
        this.observe();
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
        this.documentVisible = false;
        this.runtimeActive = false;
        this.disconnectObserver();
    }

    private reconcile() {
        if (!this.shouldLocate()) {
            this.disconnectObserver();
            return;
        }
        this.refresh();
    }

    private shouldLocate() {
        return !this.disposed && this.documentVisible && this.runtimeActive;
    }

    private observe() {
        if (this.observerActive) {
            return;
        }
        this.observerActive = true;
        this.observer.observe(this.options.observeTarget, {
            childList: true,
            subtree: true,
        });
    }

    private disconnectObserver() {
        if (!this.observerActive) {
            return;
        }
        this.observerActive = false;
        this.observer.disconnect();
    }
}
