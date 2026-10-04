import type { RootStore } from '@react-three/fiber';

type SceneAnimation = {
    readonly idle: boolean;
    advance: (deltaMs: number) => void;
};

const roots = new WeakMap<RootStore, SceneRootRuntime>();
const firstFrameDeltaMs = 1000 / 60;
const maximumFrameDeltaMs = 64;

/** Owns demand work independently of R3F's module-global loop. */
export class SceneRootRuntime {
    private visible = false;
    private connected = false;
    private rendering = false;
    private requestDemand: ((frames: number) => void) | undefined;
    private frame: number | null = null;
    private lastTimestamp: number | null = null;
    private animations = new Set<SceneAnimation>();
    private afterFrame = new Set<() => void>();
    private animationEvents: (() => void)[] = [];

    constructor(private readonly store: RootStore) {}

    isVisible = () => this.visible;

    invalidate = (frames = 1) => {
        if (!Number.isFinite(frames) || frames <= 0 || this.rendering) return;
        if (!this.connected || !this.visible) return;
        if (this.requestDemand) this.requestDemand(frames);
        else this.requestFrame();
    };

    /** Called only after the semantic scheduler admits an owned frame. */
    requestFrame = () => {
        if (!this.connected || !this.visible || this.frame !== null) return;
        this.frame = requestAnimationFrame(this.render);
    };

    private render = (timestamp: number) => {
        this.frame = null;
        if (!this.connected || !this.visible) return;
        const state = this.store.getState();
        if (!state.internal.active) return;
        const deltaMs =
            this.lastTimestamp === null
                ? firstFrameDeltaMs
                : Math.min(
                      maximumFrameDeltaMs,
                      Math.max(0, timestamp - this.lastTimestamp),
                  );
        this.lastTimestamp = timestamp;
        this.rendering = true;
        try {
            for (const animation of this.animations) {
                if (!animation.idle) animation.advance(deltaMs);
                if (animation.idle) this.animations.delete(animation);
            }
            const events = this.animationEvents;
            this.animationEvents = [];
            for (const event of events) event();
            // R3F's manual clock accepts seconds. Never flush global spring/effect
            // queues: they may belong to a different Canvas or a DOM animation.
            state.advance(state.clock.elapsedTime + deltaMs / 1000, false);
            this.flushAfterFrame();
        } finally {
            this.rendering = false;
        }
        if (this.animations.size > 0 || this.animationEvents.length > 0)
            this.invalidate();
    };

    startAnimation = (animation: SceneAnimation) => {
        this.animations.add(animation);
        this.invalidate();
    };

    removeAnimation = (animation: SceneAnimation) => {
        this.animations.delete(animation);
    };

    queueAnimationEvent = (event: () => void) => {
        this.animationEvents.push(event);
        this.invalidate();
    };

    flushAfterFrame = () => {
        for (const listener of this.afterFrame) listener();
    };

    subscribeAfterFrame = (listener: () => void) => {
        this.afterFrame.add(listener);
        return () => {
            this.afterFrame.delete(listener);
        };
    };

    setVisible = (visible: boolean) => {
        if (this.visible === visible) return;
        this.visible = visible;
        this.lastTimestamp = null;
        if (visible) this.invalidate();
        else this.cancelFrame();
    };

    private cancelFrame() {
        if (this.frame !== null) cancelAnimationFrame(this.frame);
        this.frame = null;
    }

    connect = (requestDemand?: (frames: number) => void) => {
        this.requestDemand = requestDemand;
        const originalInvalidate = this.store.getState().invalidate;
        this.connected = true;
        const protectRoot = () => {
            const state = this.store.getState();
            // Store subscriptions inside R3F bypass state.invalidate. Keep the
            // root out of that loop even after resize/configuration changes.
            state.internal.frames = 0;
            if (state.frameloop !== 'never') state.setFrameloop('never');
            if (state.invalidate !== this.invalidate) {
                this.store.setState({ invalidate: this.invalidate });
            }
            this.invalidate();
        };
        const unsubscribe = this.store.subscribe(protectRoot);
        protectRoot();
        return () => {
            this.connected = false;
            this.requestDemand = undefined;
            this.cancelFrame();
            this.lastTimestamp = null;
            unsubscribe();
            this.store.setState({ invalidate: originalInvalidate });
        };
    };
}

export function getSceneRootRuntime(store: RootStore) {
    let runtime = roots.get(store);
    if (!runtime) {
        runtime = new SceneRootRuntime(store);
        roots.set(store, runtime);
    }
    return runtime;
}
