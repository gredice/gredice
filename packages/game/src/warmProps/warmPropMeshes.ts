import {
    ConeGeometry,
    DynamicDrawUsage,
    InstancedBufferAttribute,
    InstancedMesh,
    MeshStandardMaterial,
    PlaneGeometry,
    ShaderMaterial,
} from 'three';

export function createWarmPropMeshes(capacity: number) {
    const fireGeometry = new ConeGeometry(0.045, 0.14, 5);
    fireGeometry.translate(0, 0.07, 0);
    const fire = new InstancedMesh(
        fireGeometry,
        new MeshStandardMaterial({
            color: '#ffb344',
            emissive: '#ff741c',
            emissiveIntensity: 2,
            roughness: 1,
            toneMapped: false,
        }),
        capacity * 3,
    );
    fire.name = 'WarmProps:Fire';
    const smokeGeometry = new PlaneGeometry(1, 1);
    smokeGeometry.setAttribute(
        'smokeOpacity',
        new InstancedBufferAttribute(
            new Float32Array(capacity * 3),
            1,
        ).setUsage(DynamicDrawUsage),
    );
    const smoke = new InstancedMesh(
        smokeGeometry,
        new ShaderMaterial({
            transparent: true,
            depthWrite: false,
            depthTest: true,
            vertexShader: `
            attribute float smokeOpacity;
            varying float vOpacity;
            varying vec2 vUv;
            void main() {
                vUv = uv * 2.0 - 1.0;
                vOpacity = smokeOpacity;
                gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
            }
        `,
            fragmentShader: `
            varying float vOpacity;
            varying vec2 vUv;
            void main() {
                float alpha = (1.0 - smoothstep(0.1, 1.0, length(vUv))) * vOpacity;
                if (alpha < 0.002) discard;
                gl_FragColor = vec4(0.42, 0.40, 0.38, alpha);
                #include <colorspace_fragment>
            }
        `,
        }),
        capacity * 3,
    );
    smoke.name = 'WarmProps:Smoke';
    for (const mesh of [fire, smoke]) {
        mesh.count = 0;
        mesh.frustumCulled = false; // Individual source culling happens before filling the bounded pool.
        mesh.raycast = () => {};
        mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    }
    return {
        fire,
        smoke,
        dispose() {
            for (const mesh of [fire, smoke]) {
                mesh.geometry.dispose();
                mesh.material.dispose();
                mesh.dispose();
            }
        },
    };
}
