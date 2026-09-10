'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as SunCalc from 'suncalc';
import {
    Color,
    DoubleSide,
    type Mesh,
    ShaderMaterial,
    Vector2,
    Vector3,
} from 'three';
import { useGameState } from '../useGameState';
import { useSceneRenderRequest, useSceneTimeInvalidation } from './SceneTime';
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
const WORLD_SKY_RADIUS = 800;

const skyGradientVertex = /* glsl */ `
    varying vec2 vUv;
    varying vec3 vSkyDirection;

    void main() {
        vUv = uv;
        vSkyDirection = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const skyGradientFragment = /* glsl */ `
    varying vec2 vUv;
    varying vec3 vSkyDirection;

    uniform float uAspect;
    uniform float uWorldSky;
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
    uniform vec3 uSunDirection;
    uniform vec3 uMoonDirection;

    float glowAt(vec2 p, vec2 center, float radius) {
        vec2 delta = p - center;
        delta.x *= uAspect;
        return 1.0 - smoothstep(radius * 0.24, radius, length(delta));
    }

    void main() {
        vec3 skyDirection = normalize(vSkyDirection);
        float worldSkyY = clamp(
            0.42 + asin(clamp(skyDirection.y, -1.0, 1.0)) / 3.14159265 * 4.2,
            0.0,
            1.0
        );
        float y = mix(clamp(vUv.y, 0.0, 1.0), worldSkyY, uWorldSky);
        vec3 color = mix(uLowerColor, uHorizonColor, smoothstep(0.0, 0.42, y));
        color = mix(color, uUpperColor, smoothstep(0.38, 0.84, y));
        color = mix(color, uZenithColor, smoothstep(0.76, 1.0, y));

        vec2 p = vUv * 2.0 - 1.0;
        float screenSunGlow = glowAt(p, uSunPosition, 0.95);
        float screenSunCore = glowAt(p, uSunPosition, 0.36);
        float screenMoonGlow = glowAt(p, uMoonPosition, 0.58);
        float sunDistance = 1.0 - dot(skyDirection, normalize(uSunDirection));
        float moonDistance = 1.0 - dot(skyDirection, normalize(uMoonDirection));
        float worldSunGlow = 1.0 - smoothstep(0.015, 0.24, sunDistance);
        float worldSunCore = 1.0 - smoothstep(0.0015, 0.035, sunDistance);
        float worldMoonGlow = 1.0 - smoothstep(0.008, 0.12, moonDistance);
        float sunGlow = mix(screenSunGlow, worldSunGlow, uWorldSky);
        float sunCore = mix(screenSunCore, worldSunCore, uWorldSky);
        float moonGlow = mix(screenMoonGlow, worldMoonGlow, uWorldSky);

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
    screenOffsetMultiplier?: number;
    solarEclipseObscuration?: number;
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

function copyVector3Uniform(
    material: ShaderMaterial,
    name: string,
    vector: Vector3,
) {
    const uniform = material.uniforms[name];
    if (uniform?.value instanceof Vector3) {
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
    screenOffsetMultiplier = 1,
    solarEclipseObscuration = 0,
    timeOfDay,
    weather,
}: SkyGradientBackgroundProps) {
    const camera = useThree((state) => state.camera);
    const requestRender = useSceneRenderRequest();
    const { width: viewportWidth, height: viewportHeight } = useThree(
        (state) => state.size,
    );
    const gameCamera = useGameState((state) => state.gameCamera);
    const gardenAvatarView = useGameState((state) => state.gardenAvatarView);
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
                    uWorldSky: { value: 0 },
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
                    uSunDirection: { value: new Vector3(0, 1, 0) },
                    uMoonDirection: { value: new Vector3(0, 1, 0) },
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
            solarEclipseObscuration,
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
        solarEclipseObscuration,
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
            requestRender('sky-gradient-target');
            return;
        }

        const alreadySettled = isSkyGradientWithinEpsilon(
            displayedGradientRef.current,
            targetGradient,
            SKY_GRADIENT_TRANSITION_EPSILON,
        );
        setTransitionActive(!alreadySettled);
        requestRender('sky-gradient-transition');
    }, [animate, hideCelestialGlow, material, requestRender, targetGradient]);

    const updateSkyProjection = useCallback(
        (force = false, shouldRequestRender = true) => {
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
            const worldSky = gardenAvatarView !== 'overview';
            material.uniforms.uWorldSky.value = worldSky ? 1 : 0;
            copyVector3Uniform(
                material,
                'uSunDirection',
                celestialState.sunDirection,
            );
            copyVector3Uniform(
                material,
                'uMoonDirection',
                celestialState.moonDirection,
            );

            if (worldSky) {
                mesh.position.copy(camera.position);
                mesh.quaternion.identity();
                mesh.scale.setScalar(1);
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
                if (shouldRequestRender) {
                    requestRender('sky-projection');
                }
                return;
            }

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
                    screenOffsetMultiplier:
                        SUN_SCREEN_OFFSET_MULTIPLIER * screenOffsetMultiplier,
                    verticalOffsetMultiplier:
                        sunTuning.verticalOffsetMultiplier,
                },
                sunScreenRef.current,
            );
            projectSkyDirectionToScreen(
                celestialState.moonDirection,
                basis,
                { screenOffsetMultiplier },
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

            if (shouldRequestRender) {
                requestRender('sky-projection');
            }
        },
        [
            camera,
            celestialState,
            gardenAvatarView,
            hideCelestialGlow,
            material,
            requestRender,
            screenOffsetMultiplier,
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

    useSceneTimeInvalidation('sky-gradient-transition', transitionActive);

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
            {gardenAvatarView === 'overview' ? (
                <planeGeometry args={[1, 1]} />
            ) : (
                <sphereGeometry args={[WORLD_SKY_RADIUS, 48, 24]} />
            )}
        </mesh>
    );
}
