import type { GameCameraSnapshot } from '../src/controls/GameCameraRigApi';

export type CameraRenderedWitness = {
    reset: () => void;
    snapshot: () => {
        frames: number;
        cameraChangeRequests: number;
        targetFramesPerSecond: number[];
        submittedCamera: GameCameraSnapshot | null;
    };
};

declare global {
    interface Window {
        cameraRenderedWitness?: CameraRenderedWitness;
    }
}
