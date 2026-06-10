export type DeviceType = 'desktop' | 'tablet' | 'mobile';

export type CubeOptions = {
    translateX?: number;
    translateY?: number;
    scale?: number;
    rotateY?: number;
    size?: number;
};

export type CubeVertex = { x: number; y: number; z: number };
export type RotateDirection = 'cw' | 'ccw';
export type PanKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';
