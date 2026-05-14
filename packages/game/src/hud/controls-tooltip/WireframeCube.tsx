import type { CubeOptions, CubeVertex } from './types';

// 8 cube vertices indexed 0–7
const V: CubeVertex[] = [
    { x: -1, y: -1, z: -1 }, // 0 left-bottom-back
    { x:  1, y: -1, z: -1 }, // 1 right-bottom-back
    { x:  1, y:  1, z: -1 }, // 2 right-top-back
    { x: -1, y:  1, z: -1 }, // 3 left-top-back
    { x: -1, y: -1, z:  1 }, // 4 left-bottom-front
    { x:  1, y: -1, z:  1 }, // 5 right-bottom-front
    { x:  1, y:  1, z:  1 }, // 6 right-top-front
    { x: -1, y:  1, z:  1 }, // 7 left-top-front
];

const CUBE_SIZE = 30;
const COS_ISO = Math.cos(Math.PI / 6);
const SIN_ISO = Math.sin(Math.PI / 6);

function project(v: CubeVertex, cosA: number, sinA: number) {
    const rx = v.x * cosA - v.z * sinA;
    const rz = v.x * sinA + v.z * cosA;
    return {
        x: (rx - rz) * COS_ISO * CUBE_SIZE + 50,
        y: -(v.y * CUBE_SIZE) + (rx + rz) * SIN_ISO * CUBE_SIZE + 50,
    };
}

function toPoints(verts: CubeVertex[], cosA: number, sinA: number) {
    return verts.map((v) => {
        const { x, y } = project(v, cosA, sinA);
        return `${x},${y}`;
    }).join(' ');
}

// Grass-block palette: top is brightest (lit from above), sides shaded for depth.
// The isometric camera direction is (1,1,1), so x-axis faces receive more light
// than z-axis faces — giving natural-looking depth even without dynamic shading.
const COLOR_TOP   = '#6db83e'; // bright grass
const COLOR_SIDE_X = '#4d8c27'; // medium — x-axis faces
const COLOR_SIDE_Z = '#2d5616'; // dark   — z-axis faces (shadow side)
const STROKE = 'rgba(0,0,0,0.2)';

export function WireframeCube({
    translateX = 0,
    scale = 1,
    rotateY = 0,
    size = 42,
}: CubeOptions) {
    const angleRad = (rotateY * Math.PI) / 180;
    const cosA = Math.cos(angleRad);
    const sinA = Math.sin(angleRad);

    // Camera direction (1,1,1) — pick the visible face for each axis:
    //   x=1 normal after Y-rotation → (cosA, 0, sinA) · (1,1,1) = cosA + sinA
    //   z=1 normal after Y-rotation → (−sinA, 0, cosA) · (1,1,1) = cosA − sinA
    const xFaceVerts = cosA + sinA > 0
        ? [V[1], V[2], V[6], V[5]] // x=1 right
        : [V[0], V[3], V[7], V[4]]; // x=−1 left

    const zFaceVerts = cosA - sinA > 0
        ? [V[4], V[7], V[6], V[5]] // z=1 front
        : [V[0], V[1], V[2], V[3]]; // z=−1 back

    const topVerts = [V[3], V[2], V[6], V[7]]; // y=1, always visible

    // Painter's algorithm: farther face (lower camera depth) is drawn first.
    // Depth of visible face = |dot(faceCenter, camera)|
    const xFirst = Math.abs(cosA + sinA) <= Math.abs(cosA - sinA);

    const face = (verts: CubeVertex[], fill: string) => (
        <polygon
            points={toPoints(verts, cosA, sinA)}
            fill={fill}
            stroke={STROKE}
            strokeWidth={0.8}
        />
    );

    return (
        <div
            className="flex items-center justify-center"
            style={{
                width: size,
                height: size,
                transform: `translateX(${translateX}px) scale(${scale})`,
                transition: 'transform 120ms linear',
            }}
        >
            <svg
                viewBox="0 0 100 100"
                className="h-full w-full overflow-visible"
                aria-hidden="true"
            >
                {xFirst ? (
                    <>
                        {face(xFaceVerts, COLOR_SIDE_X)}
                        {face(zFaceVerts, COLOR_SIDE_Z)}
                    </>
                ) : (
                    <>
                        {face(zFaceVerts, COLOR_SIDE_Z)}
                        {face(xFaceVerts, COLOR_SIDE_X)}
                    </>
                )}
                {face(topVerts, COLOR_TOP)}
            </svg>
        </div>
    );
}
