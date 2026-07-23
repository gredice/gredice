'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as SunCalc from 'suncalc';
import { Color, DoubleSide, type Mesh, ShaderMaterial, Vector2 } from 'three';
import { useGameState } from '../useGameState';
import { useSceneTimeInvalidation } from './SceneTime';
import {
    cloneSkyGradientColors,
    isSkyGradientWithinEpsilon,
    lerpSkyGradientColors,
    resolveGroundViewSkyGradientColors,
    resolveSkyGradientColors,
    type SkyGradientColors,
    type SkyGradientWeather,
} from './skyGradient';
import {
    createSkyCameraProjectionSnapshot,
    createSkyViewBasis,
    getSunViewportTuning,
    projectSkyDirectionToScreen,
    SKY_FORWARD_DISTANCE,
    SUN_SCREEN_OFFSET_MULTIPLIER,
    updateSkyCameraProjectionSnapshot,
    updateSkyViewBasis,
} from './skyProjection';
import {
    altAzToScenePosition,
    degreesToRadians,
    timeOfDayToDate,
} from './sunPosition';
import { smoothstep } from './visualDayNight';

const SKY_GRADIENT_TRANSITION_SECONDS = 0.6;
const SKY_GRADIENT_TRANSITION_EPSILON = 0.001;
const HORIZON_FADE_START = -0.05;
const HORIZON_FADE_END = 0.18;

const skyGradientVertex = /* glsl */ `
    varying vec2 vUv;

    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const skyGradientFragment = /* glsl */ `
    varying vec2 vUv;

    uniform float uAspect;
    uniform vec3 uZenithColor;
    uniform vec3 uUpperColor;
    uniform vec3 uHorizonColor;
    uniform vec3 uLowerColor;
    uniform vec3 uSunGlowColor;
    uniform vec3 uMoonGlowColor;
    uniform float uSunGlowIntensity;
    uniform float uMoonGlowIntensity;
    uniform vec2 uSunPosition;
    uniform vec2 uMoonPosition;

    float glowAt(vec2 p, vec2 center, float radius) {
        vec2 delta = p - center;
        delta.x *= uAspect;
        return 1.0 - smoothstep(radius * 0.24, radius, length(delta));
    }

    void main() {
        float y = clamp(vUv.y, 0.0, 1.0);
        vec3 color = mix(uLowerColor, uHorizonColor, smoothstep(0.0, 0.42, y));
        color = mix(color, uUpperColor, smoothstep(0.38, 0.84, y));
        color = mix(color, uZenithColor, smoothstep(0.76, 1.0, y));

        vec2 p = vUv * 2.0 - 1.0;
        float sunGlow = glowAt(p, uSunPosition, 0.95);
        float sunCore = glowAt(p, uSunPosition, 0.36);
        float moonGlow = glowAt(p, uMoonPosition, 0.58);

        color = mix(color, uSunGlowColor, clamp(sunGlow * uSunGlowIntensity, 0.0, 1.0));
        color = mix(color, vec3(1.0), clamp(sunCore * uSunGlowIntensity * 0.62, 0.0, 1.0));
        color = mix(
            color,
            uMoonGlowColor,
            clamp(moonGlow * uMoonGlowIntensity, 0.0, 1.0)
        );

        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
    }
`;

type SkyGradientBackgroundProps = {
    animate: boolean;
    backgroundColor: Color;
    backgroundPaletteIndex: number;
    currentTime: Date;
    groundView?: boolean;
    hideCelestialGlow?: boolean;
    location: { lat: number; lon: number };
    moonlight: number;
    timeOfDay: number;
    weather?: SkyGradientWeather | null;
};

function copyColorUniform(
    material: ShaderMaterial,
    name: string,
    color: Color,
) {
    const uniform = material.uniforms[name];
    if (uniform?.value instanceof Color) {
        uniform.value.copy(color);
    }
}

function copyVectorUniform(
    material: ShaderMaterial,
    name: string,
    vector: Vector2,
) {
    const uniform = material.uniforms[name];
    if (uniform?.value instanceof Vector2) {
        uniform.value.copy(vector);
    }
}

function applyGradientUniforms(
    material: ShaderMaterial,
    gradient: SkyGradientColors,
) {
    copyColorUniform(material, 'uZenithColor', gradient.zenith);
    copyColorUniform(material, 'uUpperColor', gradient.upper);
    copyColorUniform(material, 'uHorizonColor', gradient.horizon);
    copyColorUniform(material, 'uLowerColor', gradient.lower);
    copyColorUniform(material, 'uSunGlowColor', gradient.sunGlow);
    copyColorUniform(material, 'uMoonGlowColor', gradient.moonGlow);
    material.uniforms.uSunGlowIntensity.value = gradient.sunGlowIntensity;
    material.uniforms.uMoonGlowIntensity.value = gradient.moonGlowIntensity;
}

function applyVisibleGradientUniforms(
    material: ShaderMaterial,
    gradient: SkyGradientColors,
    sunOpacity: number,
    moonOpacity: number,
    hideCelestialGlow: boolean,
) {
    applyGradientUniforms(material, gradient);
    const glowVisibility = hideCelestialGlow ? 0 : 1;
    material.uniforms.uSunGlowIntensity.value =
        gradient.sunGlowIntensity * sunOpacity * glowVisibility;
    material.uniforms.uMoonGlowIntensity.value =
        gradient.moonGlowIntensity * moonOpacity * glowVisibility;
}

export function SkyGradientBackground({
    animate,
    backgroundColor,
    backgroundPaletteIndex,
    currentTime,
    groundView = false,
    hideCelestialGlow = false,
    location,
    moonlight,
    timeOfDay,
    weather,
}: SkyGradientBackgroundProps) {
    const camera = useThree((state) => state.camera);
    const invalidate = useThree((state) => state.invalidate);
    const { width: viewportWidth, height: viewportHeight } = useThree(
        (state) => state.size,
    );
    const gameCamera = useGameState((state) => state.gameCamera);
    const meshRef = useRef<Mesh>(null);
    const basisRef = useRef(createSkyViewBasis());
    const cameraProjectionSnapshotRef = useRef(
        createSkyCameraProjectionSnapshot(),
    );
    const sunScreenRef = useRef(new Vector2(0, 0));
    const moonScreenRef = useRef(new Vector2(0, 0));
    const sunOpacityRef = useRef(0);
    const moonOpacityRef = useRef(0);
    const displayedGradientRef = useRef<SkyGradientColors | null>(null);
    const targetGradientRef = useRef<SkyGradientColors | null>(null);
    const [transitionActive, setTransitionActive] = useState(false);
    const backgroundRed = backgroundColor.r;
    const backgroundGreen = backgroundColor.g;
    const backgroundBlue = backgroundColor.b;
    const currentTimeMs = currentTime.getTime();
    const locationLat = location.lat;
    const locationLon = location.lon;

    const material = useMemo(
        () =>
            new ShaderMaterial({
                vertexShader: skyGradientVertex,
                fragmentShader: skyGradientFragment,
                depthTest: false,
                depthWrite: false,
                side: DoubleSide,
                uniforms: {
                    uAspect: { value: 1 },
                    uZenithColor: { value: new Color('#e6f6ff') },
                    uUpperColor: { value: new Color('#f1f3ea') },
                    uHorizonColor: { value: new Color('#fff9ea') },
                    uLowerColor: { value: new Color('#fff9ea') },
                    uSunGlowColor: { value: new Color('#fff1bd') },
                    uMoonGlowColor: { value: new Color('#d9e8ff') },
                    uSunGlowIntensity: { value: 0 },
                    uMoonGlowIntensity: { value: 0 },
                    uSunPosition: { value: new Vector2(0, 0) },
                    uMoonPosition: { value: new Vector2(0, 0) },
                },
            }),
        [],
    );

    const targetGradient = useMemo(() => {
        const gradient = resolveSkyGradientColors({
            backgroundColor: new Color(
                backgroundRed,
                backgroundGreen,
                backgroundBlue,
            ),
            backgroundPaletteIndex,
            moonlight,
            timeOfDay,
            weather,
        });

        return groundView
            ? resolveGroundViewSkyGradientColors(gradient)
            : gradient;
    }, [
        backgroundBlue,
        backgroundGreen,
        backgroundPaletteIndex,
        backgroundRed,
        groundView,
        moonlight,
        timeOfDay,
        weather,
    ]);

    const celestialState = useMemo(() => {
        const sceneDate = timeOfDayToDate(new Date(currentTimeMs), timeOfDay);
        const sun = SunCalc.getPosition(sceneDate, locationLat, locationLon);
        const moon = SunCalc.getMoonPosition(
            sceneDate,
            locationLat,
            locationLon,
        );

        return {
            moonDirection: altAzToScenePosition(
                moon.altitude,
                moon.azimuth,
            ).normalize(),
            moonOpacity: smoothstep(
                HORIZON_FADE_START,
                HORIZON_FADE_END,
                degreesToRadians(moon.altitude),
            ),
            sunDirection: altAzToScenePosition(
                sun.altitude,
                sun.azimuth,
            ).normalize(),
            sunOpacity: smoothstep(
                HORIZON_FADE_START,
                HORIZON_FADE_END,
                degreesToRadians(sun.altitude),
            ),
        };
    }, [currentTimeMs, locationLat, locationLon, timeOfDay]);

    const sunTuning = useMemo(
        () => getSunViewportTuning(viewportWidth, viewportHeight),
        [viewportHeight, viewportWidth],
    );

    useLayoutEffect(() => {
        targetGradientRef.current = targetGradient;

        if (!displayedGradientRef.current || !animate) {
            displayedGradientRef.current =
                cloneSkyGradientColors(targetGradient);
            applyVisibleGradientUniforms(
                material,
                displayedGradientRef.current,
                sunOpacityRef.current,
                moonOpacityRef.current,
                hideCelestialGlow,
            );
            setTransitionActive(false);
            invalidate();
            return;
        }

        const alreadySettled = isSkyGradientWithinEpsilon(
            displayedGradientRef.current,
            targetGradient,
            SKY_GRADIENT_TRANSITION_EPSILON,
        );
        setTransitionActive(!alreadySettled);
        invalidate();
    }, [animate, hideCelestialGlow, invalidate, material, targetGradient]);

    const updateSkyProjection = useCallback(
        (force = false, requestRender = true) => {
            const mesh = meshRef.current;
            const cameraChanged = updateSkyCameraProjectionSnapshot(
                camera,
                cameraProjectionSnapshotRef.current,
            );
            if (
                !mesh ||
                (!force && !cameraChanged) ||
                !updateSkyViewBasis(camera, basisRef.current)
            ) {
                return;
            }

            const basis = basisRef.current;
            mesh.position
                .copy(camera.position)
                .addScaledVector(basis.forward, SKY_FORWARD_DISTANCE);
            mesh.quaternion.copy(camera.quaternion);
            mesh.scale.set(basis.halfWidth * 2, basis.halfHeight * 2, 1);
            material.uniforms.uAspect.value =
                basis.halfHeight === 0 ? 1 : basis.halfWidth / basis.halfHeight;

            projectSkyDirectionToScreen(
                celestialState.sunDirection,
                basis,
                {
                    horizontalOffsetMultiplier:
                        sunTuning.horizontalOffsetMultiplier,
                    screenOffsetMultiplier: SUN_SCREEN_OFFSET_MULTIPLIER,
                    verticalOffsetMultiplier:
                        sunTuning.verticalOffsetMultiplier,
                },
                sunScreenRef.current,
            );
            projectSkyDirectionToScreen(
                celestialState.moonDirection,
                basis,
                {},
                moonScreenRef.current,
            );
            copyVectorUniform(material, 'uSunPosition', sunScreenRef.current);
            copyVectorUniform(material, 'uMoonPosition', moonScreenRef.current);

            sunOpacityRef.current = celestialState.sunOpacity;
            moonOpacityRef.current = celestialState.moonOpacity;

            const displayed = displayedGradientRef.current;
            if (displayed) {
                applyVisibleGradientUniforms(
                    material,
                    displayed,
                    celestialState.sunOpacity,
                    celestialState.moonOpacity,
                    hideCelestialGlow,
                );
            }

            if (requestRender) {
                invalidate();
            }
        },
        [
            camera,
            celestialState,
            hideCelestialGlow,
            invalidate,
            material,
            sunTuning,
        ],
    );

    useLayoutEffect(() => {
        updateSkyProjection(true);

        if (!gameCamera) {
            return;
        }

        return gameCamera.subscribe(() => updateSkyProjection());
    }, [gameCamera, updateSkyProjection]);

    useSceneTimeInvalidation(transitionActive);

    useFrame((_, delta) => {
        updateSkyProjection(false, false);

        if (!transitionActive) {
            return;
        }

        const displayed = displayedGradientRef.current;
        const target = targetGradientRef.current;
        if (!displayed || !target) {
            setTransitionActive(false);
            return;
        }

        lerpSkyGradientColors(
            displayed,
            target,
            1 -
                Math.exp(
                    -(1 / SKY_GRADIENT_TRANSITION_SECONDS) * Math.max(0, delta),
                ),
        );

        const settled = isSkyGradientWithinEpsilon(
            displayed,
            target,
            SKY_GRADIENT_TRANSITION_EPSILON,
        );
        if (settled) {
            lerpSkyGradientColors(displayed, target, 1);
            setTransitionActive(false);
        }

        applyVisibleGradientUniforms(
            material,
            displayed,
            sunOpacityRef.current,
            moonOpacityRef.current,
            hideCelestialGlow,
        );
    });

    return (
        <mesh
            ref={meshRef}
            frustumCulled={false}
            material={material}
            name="Environment:SkyGradientBackground"
            renderOrder={-1000}
        >
            <planeGeometry args={[1, 1]} />
        </mesh>
    );
}
