import {
    BufferAttribute,
    Color,
    InstancedBufferAttribute,
    InstancedBufferGeometry,
    type IUniform,
    Mesh,
    ShaderMaterial,
} from 'three';
import { type RainPuddleSite, rainPuddleRules } from './rainPuddleState';

const outlineSegments = 48;
/** Inner ring of the outline: the light rim lies between it and the edge. */
const rimRing = 0.78;

/**
 * One flat puddle disc: a centre and two rings of the outline, as
 * (angle, ring) pairs. The vertex shader bends the rings into each puddle's
 * own wobbly outline, so every puddle shares this geometry and draws in one
 * instanced call.
 */
function createPuddleOutlineAttributes() {
    const outline = [0, 0];
    for (const ring of [rimRing, 1]) {
        for (let index = 0; index < outlineSegments; index += 1) {
            outline.push((index / outlineSegments) * Math.PI * 2, ring);
        }
    }
    const indices: number[] = [];
    for (let index = 0; index < outlineSegments; index += 1) {
        const a = 1 + index;
        const b = 1 + ((index + 1) % outlineSegments);
        indices.push(0, b, a);
        const c = 1 + outlineSegments + index;
        const d = 1 + outlineSegments + ((index + 1) % outlineSegments);
        indices.push(a, b, d, a, d, c);
    }
    return { indices, outline: new Float32Array(outline) };
}

const puddleVertexShader = /* glsl */ `
    attribute vec2 aOutline;
    attribute vec4 aPuddle;
    attribute vec4 aShape;

    uniform float uWetness;
    uniform float uSnowCover;

    varying float vEdge;
    varying vec2 vQ;
    varying vec2 vSize;
    varying vec2 vToCamera;
    varying float vSeed;
    varying float vAmount;

    void main() {
        // Ground wetness from the eased rain (resolveRainGroundWetness).
        float rain = clamp(uWetness, 0.0, 1.0);
        float wet = clamp(0.55 * smoothstep(0.0, 0.12, rain) + 0.45 * rain, 0.0, 1.0);
        float grow = 0.55 + 0.45 * smoothstep(0.4, 1.0, wet);
        vAmount = smoothstep(0.25, 0.85, wet) * (1.0 - clamp(uSnowCover, 0.0, 1.0)) * 0.95;

        float angle = aOutline.x;
        float ring = aOutline.y;
        float wobble = 1.0 +
            ${rainPuddleRules.outlineSecond.toFixed(3)} * sin(2.0 * angle + aShape.z) +
            ${rainPuddleRules.outlineThird.toFixed(3)} * sin(3.0 * angle + aShape.z * 2.3);
        vec2 q = vec2(cos(angle), sin(angle)) * wobble * ring;
        vec2 local = q * aShape.xy * grow;
        float c = cos(aPuddle.w);
        float s = sin(aPuddle.w);
        vec2 turned = vec2(local.x * c - local.y * s, local.x * s + local.y * c);
        vec3 world = vec3(aPuddle.x + turned.x, aPuddle.y, aPuddle.z + turned.y);
        gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);

        // The camera's side of the puddle, in the puddle's own axes.
        vec3 back = vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
        vec2 toCamera = vec2(back.x, back.z);
        toCamera = length(toCamera) > 0.001 ? normalize(toCamera) : vec2(0.0, -1.0);
        vToCamera = vec2(toCamera.x * c + toCamera.y * s, -toCamera.x * s + toCamera.y * c);

        vEdge = ring;
        vQ = q;
        vSize = aShape.xy;
        vSeed = aShape.z + aShape.w * 3.17;
    }
`;

const puddleFragmentShader = /* glsl */ `
    uniform vec3 uDeep;
    uniform vec3 uLight;
    uniform vec3 uRim;
    uniform float uTime;
    uniform float uRipples;

    varying float vEdge;
    varying vec2 vQ;
    varying vec2 vSize;
    varying vec2 vToCamera;
    varying float vSeed;
    varying float vAmount;

    float puddleHash(float n) {
        return fract(sin(n) * 43758.5453123);
    }

    void main() {
        if (vAmount < 0.004) discard;
        // Sky reflection: lighter toward the camera side.
        float t = clamp(0.5 + 0.495 * dot(vQ, vToCamera), 0.0, 1.0);
        vec3 color = mix(uDeep, uLight, t * 0.55);
        float rim = smoothstep(0.8, 0.94, vEdge);
        color = mix(color, uRim, rim * 0.8);
        // A glint on the far side, away from the camera.
        vec2 glintAt = -vToCamera * 0.42 + vec2(vToCamera.y, -vToCamera.x) * 0.12;
        float glint = smoothstep(0.32, 0.12, length(vQ - glintAt) * 1.35);
        color = mix(color, uRim, glint * 0.85);
        // Two ripple rings every 0.9 s.
        for (int k = 0; k < 2; k++) {
            float cycle = uTime / ${rainPuddleRules.rippleSeconds.toFixed(2)} + float(k) * 0.5 + vSeed;
            float n = floor(cycle);
            float progress = fract(cycle);
            vec2 centre = (vec2(
                puddleHash(n * 3.1 + vSeed + float(k)),
                puddleHash(n * 7.7 + vSeed * 2.0 + float(k))
            ) - 0.5) * 0.9;
            float r = length((vQ - centre) * vSize) / 0.13;
            float ripple = smoothstep(0.16, 0.0, abs(r - progress)) * (1.0 - progress) * uRipples;
            color = mix(color, uRim, ripple * 0.8);
        }
        float alpha = vAmount * smoothstep(1.0, 0.95, vEdge);
        gl_FragColor = vec4(color, alpha);
        #include <colorspace_fragment>
    }
`;

export type RainPuddleUniforms = {
    uDeep: IUniform<Color>;
    uLight: IUniform<Color>;
    uRim: IUniform<Color>;
    uRipples: IUniform<number>;
    uSnowCover: IUniform<number>;
};

export function createRainPuddleUniforms(): RainPuddleUniforms {
    return {
        uDeep: { value: new Color() },
        uLight: { value: new Color() },
        uRim: { value: new Color() },
        uRipples: { value: 1 },
        uSnowCover: { value: 0 },
    };
}

/**
 * Every puddle of a garden in one instanced draw: flat discs with a smooth
 * wobbly outline, a sky-reflection gradient, a light rim, a glint and two
 * ripple rings every 0.9 s. They grow and fade with the wetness uniform.
 */
export function createRainPuddleMesh({
    sites,
    time,
    uniforms,
    wetness,
}: {
    sites: readonly RainPuddleSite[];
    time: IUniform<number>;
    uniforms: RainPuddleUniforms;
    wetness: IUniform<number>;
}) {
    const { indices, outline } = createPuddleOutlineAttributes();
    const geometry = new InstancedBufferGeometry();
    geometry.setIndex(indices);
    geometry.setAttribute('aOutline', new BufferAttribute(outline, 2));
    // Three needs a position attribute to count vertices.
    geometry.setAttribute(
        'position',
        new BufferAttribute(new Float32Array((outline.length / 2) * 3), 3),
    );
    const puddles = new Float32Array(sites.length * 4);
    const shapes = new Float32Array(sites.length * 4);
    sites.forEach((site, index) => {
        puddles.set([site.x, site.y, site.z, site.rotation], index * 4);
        shapes.set(
            [site.halfWidth, site.halfLength, site.seed, index],
            index * 4,
        );
    });
    geometry.setAttribute('aPuddle', new InstancedBufferAttribute(puddles, 4));
    geometry.setAttribute('aShape', new InstancedBufferAttribute(shapes, 4));
    geometry.instanceCount = sites.length;

    const material = new ShaderMaterial({
        depthTest: true,
        depthWrite: false,
        fragmentShader: puddleFragmentShader,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
        transparent: true,
        uniforms: {
            ...uniforms,
            uTime: time,
            uWetness: wetness,
        },
        vertexShader: puddleVertexShader,
    });
    const mesh = new Mesh(geometry, material);
    mesh.name = `Weather:RainPuddles:count:${sites.length}`;
    mesh.frustumCulled = false;
    // Above the ground, below splash rings and water ripples.
    mesh.renderOrder = 3;
    mesh.raycast = () => undefined;
    return mesh;
}
