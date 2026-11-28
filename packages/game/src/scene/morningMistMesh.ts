import {
    Color,
    DoubleSide,
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
import type { MorningMistAnchor } from './morningMistState';

export function createMorningMistMesh(
    anchors: readonly MorningMistAnchor[],
    time: IUniform<number>,
) {
    const geometry = new PlaneGeometry(2, 2);
    geometry.setAttribute(
        'mistPhase',
        new InstancedBufferAttribute(
            new Float32Array(anchors.map((anchor) => anchor.phase)),
            1,
        ),
    );
    const material = new ShaderMaterial({
        transparent: true,
        side: DoubleSide,
        forceSinglePass: true,
        depthTest: true,
        depthWrite: false,
        fog: true,
        toneMapped: false,
        uniforms: {
            ...UniformsUtils.clone(UniformsLib.fog),
            uTime: time,
            uDensity: { value: 0 },
            // The component copies the mist role in.
            uColor: { value: new Color(0.78, 0.83, 0.85) },
            uAlpha: { value: 0.16 },
            // 0 under reduced motion: wisps stand still.
            uMotion: { value: 1 },
        },
        vertexShader: `
            attribute float mistPhase;
            varying vec2 vUv;
            varying float vPhase;
            #include <fog_pars_vertex>
            void main() {
                vUv = uv * 2.0 - 1.0;
                vPhase = mistPhase * 6.283185;
                vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
                gl_Position = projectionMatrix * mvPosition;
                #include <fog_vertex>
            }
        `,
        fragmentShader: `
            uniform float uTime;
            uniform float uDensity;
            uniform vec3 uColor;
            uniform float uAlpha;
            uniform float uMotion;
            varying vec2 vUv;
            varying float vPhase;
            #include <fog_pars_fragment>
            void main() {
                float edge = 1.0 - smoothstep(0.2, 1.0, length(vUv));
                float wisps = 0.7 + 0.3 * sin(vUv.x * 5.0 + vUv.y * 3.0 + vPhase + uTime * 0.12 * uMotion);
                float alpha = edge * edge * wisps * uDensity * uAlpha;
                if (alpha < 0.001) discard;
                gl_FragColor = vec4(uColor, alpha);
                #include <fog_fragment>
                #include <colorspace_fragment>
            }
        `,
    });
    const mesh = new InstancedMesh(geometry, material, anchors.length);
    mesh.name = 'Weather:MorningMist';
    mesh.renderOrder = 2; // Water is order 1; mist still tests its depth.
    mesh.raycast = () => {};
    const matrix = new Matrix4();
    anchors.forEach((anchor, index) => {
        matrix.makeRotationX(-Math.PI / 2);
        matrix.scale(new Vector3(anchor.radius, anchor.radius, 1));
        matrix.setPosition(...anchor.position);
        mesh.setMatrixAt(index, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (anchors.length) mesh.computeBoundingSphere();
    return mesh;
}
