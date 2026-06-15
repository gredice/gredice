import type { Camera, Vector3 } from 'three';
import type { DragEdgeAutopanPointer } from './dragEdgeAutopan';

export type GameCameraSnapshot = {
    position: [x: number, y: number, z: number];
    target: [x: number, y: number, z: number];
    zoom: number;
    version: number;
};

export type GameCameraFocusOptions = {
    immediate?: boolean;
};

export type GameCameraRigApi = {
    focus: (position: Vector3, options?: GameCameraFocusOptions) => void;
    getCamera: () => Camera | null;
    getDomElement: () => HTMLElement | null;
    getSnapshot: () => GameCameraSnapshot;
    panByDragEdge: (
        pointer: DragEdgeAutopanPointer,
        frameDeltaSeconds: number,
    ) => boolean;
    projectToScreen: (position: Vector3) => { x: number; y: number } | null;
    subscribe: (listener: (snapshot: GameCameraSnapshot) => void) => () => void;
};
