import type { CubeOptions, CubeVertex } from './types';

const cubeVertices: CubeVertex[] = [
    { x: -1, y: -1, z: -1 },
    { x: 1, y: -1, z: -1 },
    { x: 1, y: 1, z: -1 },
    { x: -1, y: 1, z: -1 },
    { x: -1, y: -1, z: 1 },
    { x: 1, y: -1, z: 1 },
    { x: 1, y: 1, z: 1 },
    { x: -1, y: 1, z: 1 },
];

const cubeEdges: [number, number][] = [
    [0, 1],
    [1, 5],
    [5, 4],
    [4, 0],
    [3, 2],
    [2, 6],
    [6, 7],
    [7, 3],
    [0, 3],
    [1, 2],
    [5, 6],
    [4, 7],
];

function projectVertex(vertex: CubeVertex, angleRad: number) {
    const cubeSize = 30;
    const cosA = Math.cos(angleRad);
    const sinA = Math.sin(angleRad);
    const rx = vertex.x * cosA - vertex.z * sinA;
    const rz = vertex.x * sinA + vertex.z * cosA;
    const isoAngle = Math.PI / 6;

    return {
        x: (rx - rz) * Math.cos(isoAngle) * cubeSize + 50,
        y:
            -(vertex.y * cubeSize) +
            (rx + rz) * Math.sin(isoAngle) * cubeSize +
            50,
    };
}

function getEdgeOpacity(
    firstVertex: CubeVertex,
    secondVertex: CubeVertex,
    angleRad: number,
) {
    const cosA = Math.cos(angleRad);
    const sinA = Math.sin(angleRad);
    const getDepth = (v: CubeVertex) =>
        v.x * sinA + v.z * cosA + (v.x * cosA - v.z * sinA);
    const averageDepth = (getDepth(firstVertex) + getDepth(secondVertex)) / 2;
    const normalized = (averageDepth + 2.8) / 5.6;
    const clamped = Math.max(0, Math.min(1, normalized));

    return 0.18 + clamped * 0.55;
}

export function WireframeCube({
    translateX = 0,
    scale = 1,
    rotateY = 0,
    size = 42,
}: CubeOptions) {
    const angleRad = (rotateY * Math.PI) / 180;
    const projected = cubeVertices.map((v) => projectVertex(v, angleRad));

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
                {cubeEdges.map(([fi, si]) => {
                    const fv = cubeVertices[fi];
                    const sv = cubeVertices[si];
                    const opacity = getEdgeOpacity(fv, sv, angleRad);

                    return (
                        <line
                            key={`${fi}-${si}`}
                            x1={projected[fi].x}
                            y1={projected[fi].y}
                            x2={projected[si].x}
                            y2={projected[si].y}
                            className="stroke-muted-foreground"
                            style={{ opacity }}
                            strokeWidth={1.5}
                            strokeLinecap="round"
                        />
                    );
                })}
            </svg>
        </div>
    );
}
