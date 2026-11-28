import {
    Color,
    DoubleSide,
    DynamicDrawUsage,
    Float32BufferAttribute,
    InstancedBufferAttribute,
    InstancedBufferGeometry,
    ShaderMaterial,
    Vector3,
} from 'three';
import { windSwooshRules } from './windSwooshLayout';

/** Points along the ribbon. */
const swooshSegments = 64;
/** Where the straight part ends and the curl begins, as a share of length. */
const curlStart = 0.7;
const curlRadius = 0.13;
/** About one and a quarter turns. */
const curlTurns = 1.55 * Math.PI;

/**
 * The swoosh ribbon in its own plane: a gentle S that ends in a curl, at
 * least 5 px thick at the default length, tapered at both ends. `aAlong`
 * runs 0 to 1 along it so the shader can draw it on and erase it.
 */
export function createWindSwooshGeometry(capacity: number) {
    const length = windSwooshRules.geometryLength;
    const points: [number, number, number][] = [];
    const waveEnd = 0.07 * Math.sin(Math.PI * 1.5);
    for (let i = 0; i <= swooshSegments; i += 1) {
        const s = i / swooshSegments;
        if (s < curlStart) {
            const k = s / curlStart;
            points.push([k * length, 0.07 * Math.sin(k * Math.PI * 1.5), s]);
        } else {
            const k = (s - curlStart) / (1 - curlStart);
            const angle = -Math.PI / 2 + k * curlTurns;
            points.push([
                length + curlRadius * Math.cos(angle),
                waveEnd + curlRadius + curlRadius * Math.sin(angle),
                s,
            ]);
        }
    }
    const positions: number[] = [];
    const along: number[] = [];
    const index: number[] = [];
    for (let i = 0; i <= swooshSegments; i += 1) {
        const [x, y, s] = points[i] ?? [0, 0, 0];
        const [x0, y0] = points[Math.max(0, i - 1)] ?? [x, y];
        const [x1, y1] = points[Math.min(swooshSegments, i + 1)] ?? [x, y];
        const tangentLength = Math.hypot(x1 - x0, y1 - y0) || 1;
        const tx = (x1 - x0) / tangentLength;
        const ty = (y1 - y0) / tangentLength;
        const halfWidth =
            0.022 * Math.sin(Math.PI * Math.min(1, s * 1.05)) ** 0.4 + 0.006;
        positions.push(
            x - ty * halfWidth - length / 2,
            y + tx * halfWidth,
            0,
            x + ty * halfWidth - length / 2,
            y - tx * halfWidth,
            0,
        );
        along.push(s, s);
        if (i < swooshSegments) {
            const a = i * 2;
            index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
    }
    const geometry = new InstancedBufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('aAlong', new Float32BufferAttribute(along, 1));
    geometry.setIndex(index);
    const place = new InstancedBufferAttribute(
        new Float32Array(Math.max(1, capacity) * 4),
        4,
    );
    place.setUsage(DynamicDrawUsage);
    geometry.setAttribute('aPlace', place);
    geometry.instanceCount = 0;
    geometry.name = 'Weather:WindSwooshGeometry';
    return geometry;
}

/**
 * Unlit swoosh material in the wind swoosh role. Each instance's `aPlace`
 * is its view spot (u, v), scale and the scene time its cycle started
 * (from `uEpoch`); the vertex shader runs the draw-on and the drift from
 * `uTime`, so the attribute changes only when a swoosh starts a cycle.
 * Under reduced motion it fades in and out in place instead of drawing on.
 */
export function createWindSwooshMaterial() {
    return new ShaderMaterial({
        name: 'Weather:WindSwooshMaterial',
        transparent: true,
        depthWrite: false,
        depthTest: false,
        side: DoubleSide,
        fog: false,
        toneMapped: false,
        uniforms: {
            uCenter: { value: new Vector3() },
            uAxisRight: { value: new Vector3(1, 0, 0) },
            uAxisUp: { value: new Vector3(0, 1, 0) },
            uFlip: { value: 1 },
            /** Scene seconds since `aPlace.w`'s epoch, life and drift. */
            uTime: { value: 0 },
            uLife: { value: windSwooshRules.lifeSeconds },
            uTravel: { value: 0 },
            uAmount: { value: 0 },
            uReduced: { value: 0 },
            uColor: { value: new Color('#fbfcff') },
        },
        vertexShader: /* glsl */ `
            attribute float aAlong;
            attribute vec4 aPlace;
            uniform float uFlip;
            uniform float uTime;
            uniform float uLife;
            uniform float uTravel;
            uniform vec3 uCenter;
            uniform vec3 uAxisRight;
            uniform vec3 uAxisUp;
            varying float vAlong;
            varying float vProgress;
            void main() {
                // Share of its life drawn; it drifts downwind as it draws.
                float progress = (uTime - aPlace.w) / max(uLife, 1e-3);
                float u = aPlace.x + uFlip * uTravel * progress;
                vec3 world = uCenter + uAxisRight * u + uAxisUp * aPlace.y;
                vec4 viewCenter = viewMatrix * vec4(world, 1.0);
                gl_Position = projectionMatrix * (
                    viewCenter +
                    vec4(position.x * uFlip * aPlace.z, position.y * aPlace.z, 0.0, 0.0)
                );
                vAlong = aAlong;
                vProgress = progress;
            }
        `,
        fragmentShader: /* glsl */ `
            uniform vec3 uColor;
            uniform float uAmount;
            uniform float uReduced;
            varying float vAlong;
            varying float vProgress;
            void main() {
                // Draws itself on along its length and erases from the tail.
                float head = vProgress * 1.6;
                float tail = head - 0.62;
                // (smoothstep needs edge0 < edge1 on every GPU.)
                float alpha = smoothstep(tail, tail + 0.16, vAlong) *
                    (1.0 - smoothstep(head - 0.06, head, vAlong));
                alpha = mix(alpha, sin(3.14159265 * clamp(vProgress, 0.0, 1.0)), uReduced);
                alpha *= uAmount * 0.92;
                if (alpha < 0.004) discard;
                gl_FragColor = vec4(uColor, alpha);
                #include <colorspace_fragment>
            }
        `,
    });
}
