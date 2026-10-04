import type {
    GardenSceneManifest,
    GardenSceneShaderVariant,
} from './gardenSceneManifest';

/**
 * - `loading`: the displayed garden's current-priority assets are not resident.
 * - `first-nonblank-frame`: a frame was submitted after they became resident.
 * - `interaction-ready`: that frame happened and the scene accepts input
 *   (transition finished, no current work pending, renderer context alive).
 */
export type GardenSceneLifecycleState =
    | 'loading'
    | 'first-nonblank-frame'
    | 'interaction-ready';

export type GardenSceneLifecycleSnapshot = {
    gardenId: number | null;
    state: GardenSceneLifecycleState;
    /** `performance.now()` when this garden started loading. */
    startedAtMs: number;
    /** Durations from `startedAtMs`; null until the state is reached. */
    firstNonblankFrameMs: number | null;
    interactionReadyMs: number | null;
    switches: number;
    contextLosses: number;
    contextRestorations: number;
};

export type GardenSceneManifestProfile = {
    version: number;
    key: string;
    gardenId: number | null;
    assets: string[];
    idleAssets: string[];
    families: string[];
    shaderVariants: GardenSceneShaderVariant[];
    unknownBlockNames: string[];
    nextGardenId: number | null;
    nextKey: string | null;
};

export function createGardenSceneManifestProfile(
    current: GardenSceneManifest | null,
    next: GardenSceneManifest | null,
): GardenSceneManifestProfile | undefined {
    if (!current) return undefined;
    return {
        version: current.version,
        key: current.key,
        gardenId: current.gardenId,
        assets: current.assets
            .filter((asset) => asset.priority !== 'idle')
            .map((asset) => asset.name),
        idleAssets: current.assets
            .filter((asset) => asset.priority === 'idle')
            .map((asset) => asset.name),
        families: [...current.families],
        shaderVariants: [...current.shaderVariants],
        unknownBlockNames: [...current.unknownBlockNames],
        nextGardenId: next?.gardenId ?? null,
        nextKey: next?.key ?? null,
    };
}

/** Pure lifecycle tracker; the caller feeds it readiness and frame receipts. */
export class GardenSceneLifecycle {
    private gardenId: number | null | undefined = undefined;
    private state: GardenSceneLifecycleState = 'loading';
    private startedAtMs: number;
    private firstNonblankFrameMs: number | null = null;
    private interactionReadyMs: number | null = null;
    private switches = 0;
    private contextLosses = 0;
    private contextRestorations = 0;
    private currentReady = false;
    private interactive = false;
    private contextAvailable = true;

    constructor(private readonly now: () => number) {
        this.startedAtMs = now();
    }

    /** Returns true when the garden changed and the lifecycle restarted. */
    setGarden(gardenId: number | null) {
        if (gardenId === this.gardenId) return false;
        if (this.gardenId !== undefined) this.switches++;
        this.gardenId = gardenId;
        this.state = 'loading';
        this.startedAtMs = this.now();
        this.firstNonblankFrameMs = null;
        this.interactionReadyMs = null;
        this.currentReady = false;
        return true;
    }

    setCurrentReady(ready: boolean) {
        this.currentReady = ready;
    }

    setInteractive(interactive: boolean) {
        this.interactive = interactive;
        this.promote();
    }

    /** Call after each submitted frame. */
    frame() {
        if (
            this.state === 'loading' &&
            this.currentReady &&
            this.contextAvailable
        ) {
            this.state = 'first-nonblank-frame';
            this.firstNonblankFrameMs ??= this.now() - this.startedAtMs;
        }
        this.promote();
    }

    contextLost() {
        if (!this.contextAvailable) return;
        this.contextAvailable = false;
        this.contextLosses++;
        // Readiness must be re-earned by a frame submitted after restore.
        // Recorded timings keep describing this garden's first load.
        this.state = 'loading';
    }

    contextRestored() {
        if (this.contextAvailable) return;
        this.contextAvailable = true;
        this.contextRestorations++;
    }

    getSnapshot(): GardenSceneLifecycleSnapshot {
        return {
            gardenId: this.gardenId ?? null,
            state: this.state,
            startedAtMs: this.startedAtMs,
            firstNonblankFrameMs: this.firstNonblankFrameMs,
            interactionReadyMs: this.interactionReadyMs,
            switches: this.switches,
            contextLosses: this.contextLosses,
            contextRestorations: this.contextRestorations,
        };
    }

    private promote() {
        if (
            this.state === 'first-nonblank-frame' &&
            this.interactive &&
            this.contextAvailable
        ) {
            this.state = 'interaction-ready';
            this.interactionReadyMs ??= this.now() - this.startedAtMs;
        }
    }
}
