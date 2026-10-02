import {
    InstancedBufferAttribute,
    InstancedMesh,
    type IUniform,
    Matrix4,
    PlaneGeometry,
    ShaderMaterial,
    UniformsLib,
    UniformsUtils,
    Vector3,
} from 'three';
import type { RainRippleAnchor } from './rainRippleState';

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
