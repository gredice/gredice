'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
    AdditiveBlending,
    BufferAttribute,
    BufferGeometry,
    type Camera,
    Color,
    DoubleSide,
    type InterleavedBufferAttribute,
    MathUtils,
    type Mesh,
    OrthographicCamera,
    Raycaster,
    ShaderMaterial,
    Vector2,
    Vector3,
} from 'three';
import {
    createPerseidsMeteor,
    PERSEIDS_RENDERING,
    type PerseidsMeteorDefinition,
    samplePerseidsIntervalSeconds,
} from './perseids';
import { useSceneTimeInvalidation } from './SceneTime';

const METEOR_SKY_DISTANCE = 42;
const METEOR_REFERENCE_VERTICAL_FOV_DEGREES = 55;
const MAX_FRAME_DELTA_SECONDS = 0.1;
const METEOR_REFERENCE_HALF_HEIGHT =
    METEOR_SKY_DISTANCE *
    Math.tan(MathUtils.degToRad(METEOR_REFERENCE_VERTICAL_FOV_DEGREES) / 2);

const meteorVertexShader = /* glsl */ `
    varying vec2 vUv;

    void main() {
        vUv = uv;
        vec4 clipPosition = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        // Meteors are sky background: keep their screen projection while
        // placing their depth behind every depth-writing garden surface.
        clipPosition.z = clipPosition.w * ${PERSEIDS_RENDERING.backgroundNdcDepth.toFixed(1)};
        gl_Position = clipPosition;
    }
`;

const meteorFragmentShader = /* glsl */ `
    uniform vec3 uColor;
    uniform float uBrightness;
    uniform float uProgress;
    uniform float uVisibility;

    varying vec2 vUv;

    void main() {
        float across = abs(vUv.y - 0.5) * 2.0;
        float widthTaper = mix(0.12, 1.0, smoothstep(0.0, 0.55, vUv.x));
        float core = 1.0 - smoothstep(
            0.05 * widthTaper,
            0.24 * widthTaper,
            across
        );
        float glow = 1.0 - smoothstep(
            0.14 * widthTaper,
            widthTaper,
            across
        );
        float tailFade = smoothstep(0.0, 0.24, vUv.x);
        float endCap = 1.0 - smoothstep(0.97, 1.0, vUv.x);
        float life = smoothstep(0.0, 0.08, uProgress) *
            (1.0 - smoothstep(0.72, 1.0, uProgress));
        float alpha = (core * 0.92 + glow * 0.3) *
            tailFade *
            mix(0.82, 1.0, endCap) *
            life *
            uBrightness *
            uVisibility;

        if (alpha <= 0.01) {
            discard;
        }

        vec3 color = mix(uColor, vec3(1.0), core * 0.55);
        gl_FragColor = vec4(color, min(1.0, alpha));
        #include <colorspace_fragment>
    }
`;

type ActiveMeteor = {
    definition: PerseidsMeteorDefinition;
    elapsedSeconds: number;
};

function createMeteorGeometry() {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
        'position',
        new BufferAttribute(new Float32Array(4 * 3), 3),
    );
    geometry.setAttribute(
        'uv',
        new BufferAttribute(new Float32Array([0, 0, 0, 1, 1, 0, 1, 1]), 2),
    );
    geometry.setIndex([0, 1, 2, 2, 1, 3]);
    return geometry;
}

function easeOutCubic(value: number) {
    return 1 - (1 - value) ** 3;
}

function getMeteorWorldWidth(width: number, camera: Camera) {
    if (!(camera instanceof OrthographicCamera)) {
        return width;
    }

    const halfHeight = (camera.top - camera.bottom) / (2 * camera.zoom);
    return width * (halfHeight / METEOR_REFERENCE_HALF_HEIGHT);
}

function setMeteorVertex(
    positions: BufferAttribute | InterleavedBufferAttribute,
    index: number,
    point: Vector3,
    perpendicular: Vector3,
    width: number,
) {
    positions.setXYZ(
        index,
        point.x + perpendicular.x * width,
        point.y + perpendicular.y * width,
        point.z + perpendicular.z * width,
    );
}

export function Perseids({
    meteorsPerHour,
    visibility,
}: {
    meteorsPerHour: number;
    visibility: number;
}) {
    const camera = useThree((state) => state.camera);
    const meshRef = useRef<Mesh>(null);
    const rateRef = useRef(meteorsPerHour);
    const activeMeteorRef = useRef<ActiveMeteor | null>(null);
    const nextMeteorInRef = useRef(Number.POSITIVE_INFINITY);
    const raycasterRef = useRef(new Raycaster());
    const ndcRef = useRef(new Vector2());
    const startOffsetRef = useRef(new Vector3());
    const endOffsetRef = useRef(new Vector3());
    const headOffsetRef = useRef(new Vector3());
    const tailOffsetRef = useRef(new Vector3());
    const headRef = useRef(new Vector3());
    const tailRef = useRef(new Vector3());
    const pathDirectionRef = useRef(new Vector3());
    const skyDirectionRef = useRef(new Vector3());
    const perpendicularRef = useRef(new Vector3());
    const geometry = useMemo(createMeteorGeometry, []);
    const material = useMemo(
        () =>
            new ShaderMaterial({
                blending: AdditiveBlending,
                depthTest: PERSEIDS_RENDERING.depthTest,
                depthWrite: PERSEIDS_RENDERING.depthWrite,
                fragmentShader: meteorFragmentShader,
                side: DoubleSide,
                toneMapped: false,
                transparent: true,
                uniforms: {
                    uBrightness: { value: 1 },
                    uColor: { value: new Color('#dcecff') },
                    uProgress: { value: 0 },
                    uVisibility: { value: 0 },
                },
                vertexShader: meteorVertexShader,
            }),
        [],
    );

    useSceneTimeInvalidation('perseid-meteors', true);

    useEffect(
        () => () => {
            geometry.dispose();
            material.dispose();
        },
        [geometry, material],
    );

    useLayoutEffect(() => {
        material.uniforms.uVisibility.value = Math.min(
            1,
            Math.max(0, visibility),
        );
    }, [material, visibility]);

    useEffect(() => {
        const previousRate = rateRef.current;
        rateRef.current = meteorsPerHour;
        if (
            Number.isFinite(nextMeteorInRef.current) &&
            nextMeteorInRef.current > 0 &&
            previousRate > 0 &&
            meteorsPerHour > 0
        ) {
            nextMeteorInRef.current *= previousRate / meteorsPerHour;
        }
    }, [meteorsPerHour]);

    useLayoutEffect(() => {
        if (meshRef.current) {
            meshRef.current.visible = false;
        }
        nextMeteorInRef.current = samplePerseidsIntervalSeconds({
            meteorsPerHour: rateRef.current,
        });
    }, []);

    useFrame((_, frameDelta) => {
        const mesh = meshRef.current;
        if (!mesh) {
            return;
        }

        const schedulerDelta = Math.max(0, frameDelta);
        const animationDelta = Math.min(
            MAX_FRAME_DELTA_SECONDS,
            schedulerDelta,
        );
        nextMeteorInRef.current -= schedulerDelta;
        const activeMeteor = activeMeteorRef.current;
        if (!activeMeteor) {
            if (nextMeteorInRef.current > 0) {
                return;
            }

            const definition = createPerseidsMeteor();
            const raycaster = raycasterRef.current;
            const ndc = ndcRef.current;
            const projectToSky = (
                point: [x: number, y: number],
                target: Vector3,
            ) => {
                ndc.set(point[0] * 2 - 1, point[1] * 2 - 1);
                raycaster.setFromCamera(ndc, camera);
                target
                    .copy(raycaster.ray.origin)
                    .addScaledVector(
                        raycaster.ray.direction,
                        METEOR_SKY_DISTANCE,
                    )
                    .sub(camera.position);
            };
            projectToSky(definition.start, startOffsetRef.current);
            projectToSky(definition.end, endOffsetRef.current);
            pathDirectionRef.current
                .subVectors(endOffsetRef.current, startOffsetRef.current)
                .normalize();

            activeMeteorRef.current = {
                definition,
                elapsedSeconds: 0,
            };
            nextMeteorInRef.current += samplePerseidsIntervalSeconds({
                meteorsPerHour: rateRef.current,
            });
            material.uniforms.uBrightness.value = definition.brightness;
            material.uniforms.uColor.value.set(
                definition.fireball ? '#fff0c7' : '#dcecff',
            );
            material.uniforms.uProgress.value = 0;
            mesh.visible = true;
            return;
        }

        activeMeteor.elapsedSeconds += animationDelta;
        const progress = Math.min(
            1,
            activeMeteor.elapsedSeconds /
                activeMeteor.definition.durationSeconds,
        );
        const headProgress = easeOutCubic(progress);
        const tailProgress = Math.max(
            0,
            headProgress - activeMeteor.definition.trailFraction,
        );
        const headOffset = headOffsetRef.current.lerpVectors(
            startOffsetRef.current,
            endOffsetRef.current,
            headProgress,
        );
        const tailOffset = tailOffsetRef.current.lerpVectors(
            startOffsetRef.current,
            endOffsetRef.current,
            tailProgress,
        );
        const head = headRef.current.copy(camera.position).add(headOffset);
        const tail = tailRef.current.copy(camera.position).add(tailOffset);
        const skyDirection = skyDirectionRef.current
            .addVectors(headOffset, tailOffset)
            .normalize();
        const perpendicular = perpendicularRef.current.crossVectors(
            pathDirectionRef.current,
            skyDirection,
        );
        if (perpendicular.lengthSq() < Number.EPSILON) {
            perpendicular.set(0, 1, 0).applyQuaternion(camera.quaternion);
        } else {
            perpendicular.normalize();
        }

        const positions = geometry.getAttribute('position');
        const width = getMeteorWorldWidth(
            activeMeteor.definition.width,
            camera,
        );
        setMeteorVertex(positions, 0, tail, perpendicular, -width * 0.45);
        setMeteorVertex(positions, 1, tail, perpendicular, width * 0.45);
        setMeteorVertex(positions, 2, head, perpendicular, -width);
        setMeteorVertex(positions, 3, head, perpendicular, width);
        positions.needsUpdate = true;
        material.uniforms.uProgress.value = progress;

        if (progress < 1) {
            return;
        }

        mesh.visible = false;
        activeMeteorRef.current = null;
    });

    return (
        <mesh
            ref={meshRef}
            frustumCulled={false}
            geometry={geometry}
            material={material}
            name="Environment:Perseids"
            renderOrder={PERSEIDS_RENDERING.renderOrder}
        />
    );
}
