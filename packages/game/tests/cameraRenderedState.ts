import type { GameCameraSnapshot } from '../src/controls/GameCameraRigApi';

export type CameraRenderedWitness = {
    reset: () => void;
    snapshot: () => {
        frames: number;
        cameraChangeRequests: number;
        targetFramesPerSecond: number[];
        submittedCamera: GameCameraSnapshot | null;
        submittedCameras: GameCameraSnapshot[];
        publishedCamera: GameCameraSnapshot | null;
        snapshotMismatches: number;
        matrixMismatches: number;
        shadowSubmissions: number;
    };
};

declare global {
    interface Window {
        cameraRenderedWitness?: CameraRenderedWitness;
    }
}
