import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { AdditiveBlending, type Points, Vector3 } from 'three';

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

        for (let i = 0; i < STAR_FIELD.count; i += 1) {
            const star = stars[i];

            values[i * STAR_RENDERING.positionStride] = star.x;
            values[i * STAR_RENDERING.positionStride + 1] = star.y;
            values[i * STAR_RENDERING.positionStride + 2] = star.z;
            colors[i * STAR_RENDERING.positionStride] = star.baseColor.r;
            colors[i * STAR_RENDERING.positionStride + 1] = star.baseColor.g;
            colors[i * STAR_RENDERING.positionStride + 2] = star.baseColor.b;
        }

        return { colors, positions: values, stars };
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

    useFrame(({ camera, clock }) => {
        if (!pointsRef.current) {
            return;
        }

        camera.getWorldDirection(cameraForwardRef.current);
        pointsRef.current.position
            .copy(camera.position)
            .addScaledVector(
                cameraForwardRef.current,
                STAR_FIELD.radiusBase + STAR_FIELD.radiusRange,
            );
        pointsRef.current.quaternion.copy(camera.quaternion);

        if (clampedVisibility <= STAR_VISIBILITY.min) {
            return;
        }

        const material = pointsRef.current.material;
        if (Array.isArray(material)) {
            return;
        }

        material.opacity =
            STAR_TWINKLE.opacityBase +
            clampedVisibility * STAR_TWINKLE.opacityVisibilityFactor;

        const colorAttribute = pointsRef.current.geometry.getAttribute('color');
        if (!colorAttribute) {
            return;
        }

        const colorValues = colorAttribute.array;
        if (!(colorValues instanceof Float32Array)) {
            return;
        }

        for (let i = 0; i < visibleCount; i += 1) {
            const star = starField.stars[i];
            const twinkle =
                star.twinkleStrength > 0
                    ? ((Math.sin(
                          clock.elapsedTime * star.twinkleSpeed +
                              star.twinkleOffset,
                      ) +
                          1) /
                          2) *
                      star.twinkleStrength *
                      clampedVisibility
                    : 0;

            colorValues[i * STAR_RENDERING.positionStride] = Math.min(
                STAR_VISIBILITY.max,
                star.baseColor.r * (1 + twinkle * star.twinkleColor.r),
            );
            colorValues[i * STAR_RENDERING.positionStride + 1] = Math.min(
                STAR_VISIBILITY.max,
                star.baseColor.g * (1 + twinkle * star.twinkleColor.g),
            );
            colorValues[i * STAR_RENDERING.positionStride + 2] = Math.min(
                STAR_VISIBILITY.max,
                star.baseColor.b * (1 + twinkle * star.twinkleColor.b),
            );
        }

        colorAttribute.needsUpdate = true;
    });

    return (
        <points
            ref={pointsRef}
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
            </bufferGeometry>
            <pointsMaterial
                size={STAR_RENDERING.materialSize}
                sizeAttenuation
                transparent={false}
                opacity={
                    STAR_TWINKLE.opacityBase +
                    clampedVisibility * STAR_TWINKLE.opacityVisibilityFactor
                }
                depthTest={false}
                depthWrite={false}
                blending={AdditiveBlending}
                vertexColors
            />
        </points>
    );
}
