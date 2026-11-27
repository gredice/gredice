import {
    Color,
    DataTexture,
    FloatType,
    InstancedBufferAttribute,
    InstancedBufferGeometry,
    InstancedMesh,
    type IUniform,
    Matrix4,
    Mesh,
    NearestFilter,
    PlaneGeometry,
    RGBAFormat,
    ShaderMaterial,
    UniformsLib,
    UniformsUtils,
    Vector3,
} from 'three';
import type { RainRippleAnchor, RainSplashCell } from './rainRippleState';

export function createRainRippleMesh({
    anchors,
    time,
    rain,
    wetness,
    puddleStrength,
}: {
    anchors: readonly RainRippleAnchor[];
    time: IUniform<number>;
    rain: IUniform<number>;
    wetness: IUniform<number>;
    puddleStrength: IUniform<number>;
}) {
    const geometry = new PlaneGeometry(2, 2);
    const surfaces = new Float32Array(anchors.length * 2);
    const seeds = new Float32Array(anchors.length * 2);
    anchors.forEach((anchor, index) => {
        surfaces[index * 2] = anchor.water ? 1 : 0;
        surfaces[index * 2 + 1] = anchor.opacity;
        seeds[index * 2] = anchor.phase;
        seeds[index * 2 + 1] = anchor.period;
    });
    geometry.setAttribute('rippleSeed', new InstancedBufferAttribute(seeds, 2));
    geometry.setAttribute(
        'rippleSurface',
        new InstancedBufferAttribute(surfaces, 2),
    );
    const material = new ShaderMaterial({
        transparent: true,
        fog: true,
        depthWrite: false,
        depthTest: true,
        toneMapped: false,
        uniforms: {
            ...UniformsUtils.clone(UniformsLib.fog),
            uTime: time,
            uRain: rain,
            uWetness: wetness,
            uPuddleStrength: puddleStrength,
        },
        vertexShader: `
            uniform float uTime;
            attribute vec2 rippleSeed;
            attribute vec2 rippleSurface;
            varying vec2 vUv;
            varying vec2 vSurface;
            varying float vAge;
            #include <fog_pars_vertex>
            void main() {
                vSurface = rippleSurface;
                vUv = uv * 2.0 - 1.0;
                vAge = fract(uTime / rippleSeed.y + rippleSeed.x);
                vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
                gl_Position = projectionMatrix * mvPosition;
                #include <fog_vertex>
            }
        `,
        fragmentShader: `
            uniform float uWetness;
            uniform float uRain;
            uniform float uPuddleStrength;
            varying vec2 vUv;
            varying vec2 vSurface;
            varying float vAge;
            #include <fog_pars_fragment>
            void main() {
                float radius = mix(0.08, 0.95, vAge);
                float distanceToRing = abs(length(vUv) - radius);
                float width = max(fwidth(distanceToRing), 0.035);
                float ring = 1.0 - smoothstep(0.02, 0.02 + width, distanceToRing);
                float envelope = smoothstep(0.0, 0.12, vAge) * (1.0 - vAge) * (1.0 - vAge);
                float wet = smoothstep(0.6, 1.0, uWetness);
                float strength = mix(wet * uPuddleStrength, smoothstep(0.02, 0.25, uRain), vSurface.x);
                float alpha = ring * envelope * strength * vSurface.y;
                if (alpha < 0.002) discard;
                gl_FragColor = vec4(0.72, 0.82, 0.84, alpha);
                #include <fog_fragment>
                #include <colorspace_fragment>
            }
        `,
    });
    const mesh = new InstancedMesh(geometry, material, anchors.length);
    mesh.name = 'Weather:RainRipples';
    // Water is transparent at renderOrder 1 and must render before its rings.
    mesh.renderOrder = 2;
    mesh.raycast = () => {};
    const matrix = new Matrix4();
    anchors.forEach((anchor, index) => {
        matrix.makeRotationX(-Math.PI / 2);
        matrix.scale(new Vector3(anchor.radius, anchor.radius, 1));
        matrix.setPosition(...anchor.position);
        mesh.setMatrixAt(index, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    return mesh;
}

/** Most landing cells the splash texture holds (texels per row × rows). */
const splashCellTextureWidth = 256;

/**
 * Landing cells as a float texture the splash vertex shader samples: one
 * texel per cell, (x, y, z, half extent).
 */
export function createRainSplashCellTexture(cells: readonly RainSplashCell[]) {
    const count = Math.max(1, cells.length);
    const width = Math.min(splashCellTextureWidth, count);
    const height = Math.ceil(count / width);
    const data = new Float32Array(width * height * 4);
    cells.forEach((cell, index) => {
        data.set([cell.x, cell.y, cell.z, cell.halfExtent], index * 4);
    });
    const texture = new DataTexture(data, width, height, RGBAFormat, FloatType);
    texture.minFilter = NearestFilter;
    texture.magFilter = NearestFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return { texture, width, count: cells.length };
}

export type RainSplashUniforms = {
    uAlpha: IUniform<number>;
    uColor: IUniform<Color>;
    uEdge: IUniform<Color>;
};

export function createRainSplashUniforms(): RainSplashUniforms {
    return {
        uAlpha: { value: 0 },
        uColor: { value: new Color() },
        uEdge: { value: new Color() },
    };
}

const splashVertexShader = /* glsl */ `
    attribute vec2 aSeed;

    uniform sampler2D uCells;
    uniform int uCellCount;
    uniform int uCellWidth;
    uniform float uTime;
    uniform float uLife;
    uniform float uRadius;

    varying vec2 vUv;
    varying float vProgress;

    uint splashHash(uint x) {
        x ^= x >> 16u;
        x *= 0x7feb352du;
        x ^= x >> 15u;
        x *= 0x846ca68bu;
        x ^= x >> 16u;
        return x;
    }

    float splashUnit(uint x) {
        return float(splashHash(x) & 0xffffffu) / 16777216.0;
    }

    void main() {
        float cycle = uTime / uLife + aSeed.x * 7.0;
        float index = floor(cycle);
        float progress = fract(cycle);
        uint base = uint(mod(index, 16777216.0)) * 747796405u + uint(aSeed.y * 65535.0) * 2891336453u;

        // Pick a landing cell for this cycle. Prefer one on screen: try a few
        // cells and keep the first inside the view.
        vec3 landing = vec3(0.0, -1000.0, 0.0);
        for (int k = 0; k < 6; k++) {
            uint h = splashHash(base + uint(k) * 0x9e3779b9u);
            int cellIndex = int(h % uint(max(uCellCount, 1)));
            vec4 cell = texelFetch(uCells, ivec2(cellIndex % uCellWidth, cellIndex / uCellWidth), 0);
            vec2 jitter = (vec2(splashUnit(h ^ 0x68bc21ebu), splashUnit(h ^ 0x02e5be93u)) * 2.0 - 1.0) * cell.w;
            landing = vec3(cell.x + jitter.x, cell.y + 0.008, cell.z + jitter.y);
            vec4 clip = projectionMatrix * viewMatrix * vec4(landing, 1.0);
            if (all(lessThan(abs(clip.xy / clip.w), vec2(1.02)))) break;
        }

        float radius = uRadius * (0.25 + 0.75 * sqrt(progress));
        vec3 world = landing + vec3(position.x, 0.0, position.z) * radius * 2.0;
        gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
        vUv = uv;
        vProgress = progress;
    }
`;

const splashFragmentShader = /* glsl */ `
    uniform vec3 uColor;
    uniform vec3 uEdge;
    uniform float uAlpha;

    varying vec2 vUv;
    varying float vProgress;

    void main() {
        // A thin ring (about 2 px at the default zoom) near the rim.
        float r = length(vUv - 0.5) * 2.0;
        float ring = smoothstep(0.16, 0.04, abs(r - 0.8));
        float fade = pow(1.0 - vProgress, 1.3);
        // A small impact dot in the first quarter of its life.
        float impact = 0.85 * smoothstep(0.26, 0.08, r) * smoothstep(0.25, 0.0, vProgress);
        vec3 color = mix(uColor, uEdge, 0.45 * smoothstep(0.7, 0.95, r));
        float alpha = max(ring * fade, impact) * uAlpha;
        if (alpha < 0.004) discard;
        gl_FragColor = vec4(color, alpha);
        #include <colorspace_fragment>
    }
`;

/**
 * Splash rings in one instanced draw (GAME_ART.md "Weather > Rain and heavy
 * rain"): each instance lives `lifeSeconds` (0.45 s), lands on a random cell
 * from the cell texture, grows to `radius` (0.12) and fades, with an impact
 * dot in its first quarter. `geometry.instanceCount` sets how many show at
 * once.
 */
export function createRainSplashMesh({
    capacity,
    cells,
    lifeSeconds,
    radius,
    time,
    uniforms,
}: {
    capacity: number;
    cells: ReturnType<typeof createRainSplashCellTexture>;
    lifeSeconds: number;
    radius: number;
    time: IUniform<number>;
    uniforms: RainSplashUniforms;
}) {
    const plane = new PlaneGeometry(1, 1);
    plane.rotateX(-Math.PI / 2);
    const geometry = new InstancedBufferGeometry();
    geometry.setIndex(plane.getIndex());
    geometry.setAttribute('position', plane.getAttribute('position'));
    geometry.setAttribute('uv', plane.getAttribute('uv'));
    const seeds = new Float32Array(Math.max(1, capacity) * 2);
    for (let index = 0; index < Math.max(1, capacity); index += 1) {
        // Golden-ratio phases spread the rings evenly in time.
        seeds[index * 2] = (index * 0.618034) % 1;
        seeds[index * 2 + 1] = ((index * 0.754878 + 0.31) % 1) * 0.999;
    }
    geometry.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 2));
    geometry.instanceCount = 0;
    const material = new ShaderMaterial({
        depthTest: true,
        depthWrite: false,
        fragmentShader: splashFragmentShader,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
        transparent: true,
        uniforms: {
            ...uniforms,
            uCells: { value: cells.texture },
            uCellCount: { value: cells.count },
            uCellWidth: { value: cells.width },
            uLife: { value: lifeSeconds },
            uRadius: { value: radius },
            uTime: time,
        },
        vertexShader: splashVertexShader,
    });
    const mesh = new Mesh(geometry, material);
    mesh.name = 'Weather:RainSplashes';
    mesh.frustumCulled = false;
    // After puddles (3) and water (1), before the drops (35).
    mesh.renderOrder = 5;
    mesh.raycast = () => undefined;
    return mesh;
}
