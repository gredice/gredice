import { useThree } from '@react-three/fiber';
import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import {
    AdditiveBlending,
    type OrthographicCamera,
    type Points,
    Vector3,
} from 'three';
import { defaultGameCameraZoom } from '../gameCamera';
import { useGameState } from '../useGameState';
import { useSceneTimeUniform } from './SceneTime';

const STAR_VISIBILITY = {
    min: 0,
    max: 1,
    minVisibleCount: 12,
};

const STAR_FIELD = {
    count: 120,
    radiusBase: 10,
    radiusRange: 10,
    // 1 = centered straight ahead, 0 = edge of the forward hemisphere.
    minForwardDot: 0,
    // Probability falloff applied near the edge of the forward hemisphere so
    // the count fades out smoothly instead of cutting off.
    edgeFadeStart: 0.15,
};

const STAR_BRIGHTNESS = {
    base: 0.35,
    range: 0.65,
};

const STAR_COLOR = {
    toneBase: 0.7,
    toneRange: 0.3,
    greenLift: 0.02,
    blueLift: 0.08,
};

const STAR_TWINKLE = {
    activeChance: 0.35,
    speedBase: 0.7,
    speedRange: 2.4,
    offsetRange: Math.PI * 2,
    opacityBase: 0.16,
    opacityVisibilityFactor: 0.12,
    intensityBase: 0.15,
    intensityRange: 0.45,
};

const STAR_TWINKLE_COLOR = {
    minFactor: 0.8,
    maxFactor: 1.3,
};

const STAR_RENDERING = {
    renderOrder: -1,
    positionStride: 3,
    materialSize: 1.65,
};

type StarsProps = {
    visibility?: number;
};

export function Stars({ visibility = 1 }: StarsProps) {
    const pointsRef = useRef<Points>(null);
    const camera = useThree((state) => state.camera);
    const gameCamera = useGameState((state) => state.gameCamera);
    const timeUniform = useSceneTimeUniform();
    const cameraForwardRef = useRef(new Vector3());
    const clampedVisibility = Math.min(
        STAR_VISIBILITY.max,
        Math.max(STAR_VISIBILITY.min, visibility),
    );

    const starField = useMemo(() => {
        const stars = Array.from({ length: STAR_FIELD.count }, () => {
            const radius =
                STAR_FIELD.radiusBase + Math.random() * STAR_FIELD.radiusRange;
            const theta = Math.random() * Math.PI * 2;
            // Uniform area distribution on a camera-facing spherical cap:
            // sample the forward dot product uniformly so stars stay centered
            // in view instead of clustering toward screen-top.
            let forwardDot =
                STAR_FIELD.minForwardDot +
                Math.random() * (1 - STAR_FIELD.minForwardDot);
            // Soft edge fade: thin the population near the edge of the view.
            if (forwardDot < STAR_FIELD.edgeFadeStart) {
                const edgeT = Math.max(
                    0,
                    (forwardDot - STAR_FIELD.minForwardDot) /
                        (STAR_FIELD.edgeFadeStart - STAR_FIELD.minForwardDot),
                );
                if (Math.random() > edgeT) {
                    // Re-roll toward the center of the view to fade gracefully.
                    forwardDot =
                        STAR_FIELD.edgeFadeStart +
                        Math.random() * (1 - STAR_FIELD.edgeFadeStart);
                }
            }
            const edgeRadius = Math.sqrt(
                Math.max(0, 1 - forwardDot * forwardDot),
            );
            const brightness =
                STAR_BRIGHTNESS.base + Math.random() * STAR_BRIGHTNESS.range;
            const tone =
                STAR_COLOR.toneBase + brightness * STAR_COLOR.toneRange;
            const twinkleStrength =
                Math.random() <= STAR_TWINKLE.activeChance
                    ? STAR_TWINKLE.intensityBase +
                      Math.random() * STAR_TWINKLE.intensityRange
                    : 0;
            const direction = new Vector3(
                Math.cos(theta) * edgeRadius,
                Math.sin(theta) * edgeRadius,
                -forwardDot,
            );

            const baseColor = {
                r: tone,
                g: Math.min(STAR_VISIBILITY.max, tone + STAR_COLOR.greenLift),
                b: Math.min(STAR_VISIBILITY.max, tone + STAR_COLOR.blueLift),
            };

            return {
                baseColor,
                brightness,
                x: direction.x * radius,
                y: direction.y * radius,
                z: direction.z * radius,
                twinkleColor: {
                    r:
                        STAR_TWINKLE_COLOR.minFactor +
                        Math.random() *
                            (STAR_TWINKLE_COLOR.maxFactor -
                                STAR_TWINKLE_COLOR.minFactor),
                    g:
                        STAR_TWINKLE_COLOR.minFactor +
                        Math.random() *
                            (STAR_TWINKLE_COLOR.maxFactor -
                                STAR_TWINKLE_COLOR.minFactor),
                    b:
                        STAR_TWINKLE_COLOR.minFactor +
                        Math.random() *
                            (STAR_TWINKLE_COLOR.maxFactor -
                                STAR_TWINKLE_COLOR.minFactor),
                },
                twinkleOffset: Math.random() * STAR_TWINKLE.offsetRange,
                twinkleSpeed:
                    STAR_TWINKLE.speedBase +
                    Math.random() * STAR_TWINKLE.speedRange,
                twinkleStrength,
            };
        }).sort((left, right) => right.brightness - left.brightness);

        const values = new Float32Array(
            STAR_FIELD.count * STAR_RENDERING.positionStride,
        );
        const colors = new Float32Array(
            STAR_FIELD.count * STAR_RENDERING.positionStride,
        );
        const twinkleColors = new Float32Array(
            STAR_FIELD.count * STAR_RENDERING.positionStride,
        );
        const twinkleParams = new Float32Array(
            STAR_FIELD.count * STAR_RENDERING.positionStride,
        );

        for (let i = 0; i < STAR_FIELD.count; i += 1) {
            const star = stars[i];
            const attributeOffset = i * STAR_RENDERING.positionStride;

            values[attributeOffset] = star.x;
            values[attributeOffset + 1] = star.y;
            values[attributeOffset + 2] = star.z;
            colors[attributeOffset] = star.baseColor.r;
            colors[attributeOffset + 1] = star.baseColor.g;
            colors[attributeOffset + 2] = star.baseColor.b;
            twinkleColors[attributeOffset] = star.twinkleColor.r;
            twinkleColors[attributeOffset + 1] = star.twinkleColor.g;
            twinkleColors[attributeOffset + 2] = star.twinkleColor.b;
            twinkleParams[attributeOffset] = star.twinkleSpeed;
            twinkleParams[attributeOffset + 1] = star.twinkleOffset;
            twinkleParams[attributeOffset + 2] = star.twinkleStrength;
        }

        return {
            colors,
            positions: values,
            twinkleColors,
            twinkleParams,
        };
    }, []);

    const visibleCount = useMemo(() => {
        if (clampedVisibility <= STAR_VISIBILITY.min) {
            return 0;
        }

        return Math.max(
            STAR_VISIBILITY.minVisibleCount,
            Math.round(STAR_FIELD.count * clampedVisibility),
        );
    }, [clampedVisibility]);

    const visiblePositions = useMemo(
        () =>
            starField.positions.subarray(
                0,
                visibleCount * STAR_RENDERING.positionStride,
            ),
        [starField, visibleCount],
    );
    const visibleColors = useMemo(
        () =>
            starField.colors.subarray(
                0,
                visibleCount * STAR_RENDERING.positionStride,
            ),
        [starField, visibleCount],
    );
    const visibleTwinkleColors = useMemo(
        () =>
            starField.twinkleColors.subarray(
                0,
                visibleCount * STAR_RENDERING.positionStride,
            ),
        [starField, visibleCount],
    );
    const visibleTwinkleParams = useMemo(
        () =>
            starField.twinkleParams.subarray(
                0,
                visibleCount * STAR_RENDERING.positionStride,
            ),
        [starField, visibleCount],
    );
    const starUniforms = useMemo(
        () => ({
            uOpacity: {
                value:
                    STAR_TWINKLE.opacityBase +
                    clampedVisibility * STAR_TWINKLE.opacityVisibilityFactor,
            },
            uPointSize: { value: STAR_RENDERING.materialSize },
            uTime: timeUniform,
            uVisibility: { value: clampedVisibility },
        }),
        [clampedVisibility, timeUniform],
    );

    const updateCameraFacing = useCallback(() => {
        if (!pointsRef.current) {
            return;
        }

        const orthographic = camera as OrthographicCamera;
        pointsRef.current.scale.setScalar(
            orthographic.isOrthographicCamera
                ? defaultGameCameraZoom / orthographic.zoom
                : 1,
        );

        camera.getWorldDirection(cameraForwardRef.current);
        pointsRef.current.position
            .copy(camera.position)
            .addScaledVector(
                cameraForwardRef.current,
                STAR_FIELD.radiusBase + STAR_FIELD.radiusRange,
            );
        pointsRef.current.quaternion.copy(camera.quaternion);
    }, [camera]);

    useLayoutEffect(() => {
        if (!gameCamera) {
            updateCameraFacing();
            return;
        }

        return gameCamera.subscribe(() => updateCameraFacing());
    }, [gameCamera, updateCameraFacing]);

    return (
        <points
            ref={pointsRef}
            name={`Environment:Stars:count:${visibleCount}`}
            frustumCulled={false}
            renderOrder={STAR_RENDERING.renderOrder}
            visible={visibleCount > 0}
        >
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    args={[visiblePositions, STAR_RENDERING.positionStride]}
                    count={visibleCount}
                />
                <bufferAttribute
                    attach="attributes-color"
                    args={[visibleColors, STAR_RENDERING.positionStride]}
                    count={visibleCount}
                />
                <bufferAttribute
                    attach="attributes-twinkleColor"
                    args={[visibleTwinkleColors, STAR_RENDERING.positionStride]}
                    count={visibleCount}
                />
                <bufferAttribute
                    attach="attributes-twinkleParams"
                    args={[visibleTwinkleParams, STAR_RENDERING.positionStride]}
                    count={visibleCount}
                />
            </bufferGeometry>
            <shaderMaterial
                uniforms={starUniforms}
                vertexShader={
                    /* glsl */ `
                    attribute vec3 color;
                    attribute vec3 twinkleColor;
                    attribute vec3 twinkleParams;

                    uniform float uPointSize;
                    uniform float uTime;
                    uniform float uVisibility;

                    varying vec3 vColor;

                    void main() {
                        float twinkle = twinkleParams.z > 0.0
                            ? ((sin(uTime * twinkleParams.x + twinkleParams.y) + 1.0) * 0.5) *
                                twinkleParams.z *
                                uVisibility
                            : 0.0;

                        vColor = min(
                            vec3(1.0),
                            color * (1.0 + twinkle * twinkleColor)
                        );
                        gl_PointSize = uPointSize;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    }
                `
                }
                fragmentShader={
                    /* glsl */ `
                    uniform float uOpacity;
                    varying vec3 vColor;

                    void main() {
                        vec2 pointUv = gl_PointCoord - vec2(0.5);
                        float pointAlpha = smoothstep(0.5, 0.16, length(pointUv));
                        if (pointAlpha <= 0.01) {
                            discard;
                        }

                        gl_FragColor = vec4(vColor, pointAlpha * uOpacity);
                        #include <colorspace_fragment>
                    }
                `
                }
                transparent
                depthTest={false}
                depthWrite={false}
                blending={AdditiveBlending}
            />
        </points>
    );
}
