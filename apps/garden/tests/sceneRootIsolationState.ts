export type SceneRootWitness = {
    snapshot: () => {
        frames: number;
        gpuPasses: number;
        postFrames: number;
        springAdvances: number;
        springChanges: number;
        springRests: number;
        value: number;
        declarativeValue: number;
        deltas: number[];
    };
    invalidate: () => void;
    configure: () => void;
    animate: (loop?: boolean) => void;
    visible: () => boolean;
};

declare global {
    interface Window {
        sceneRootWitness?: {
            a?: SceneRootWitness;
            b?: SceneRootWitness;
            invalidateAll: () => void;
        };
    }
}
