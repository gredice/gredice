'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as SunCalc from 'suncalc';
import { Color, DoubleSide, type Mesh, ShaderMaterial, Vector2 } from 'three';
import {
    cloneSkyGradientColors,
    lerpSkyGradientColors,
    resolveGroundViewSkyGradientColors,
    resolveSkyGradientColors,
    type SkyGradientColors,
    type SkyGradientWeather,
} from './skyGradient';
import {
    createSkyViewBasis,
    getSunViewportTuning,
    projectSkyDirectionToScreen,
    SKY_FORWARD_DISTANCE,
    SUN_SCREEN_OFFSET_MULTIPLIER,
    updateSkyViewBasis,
} from './skyProjection';
import {
    altAzToScenePosition,
    degreesToRadians,
    timeOfDayToDate,
} from './sunPosition';
import { smoothstep } from './visualDayNight';

const SKY_GRADIENT_TRANSITION_SECONDS = 0.6;
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
    groundColor?: Color;
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

export function SkyGradientBackground({
    animate,
    backgroundColor,
    backgroundPaletteIndex,
    currentTime,
    groundColor,
    location,
    moonlight,
    timeOfDay,
    weather,
}: SkyGradientBackgroundProps) {
    const camera = useThree((state) => state.camera);
    const { width: viewportWidth, height: viewportHeight } = useThree(
        (state) => state.size,
    );
    const meshRef = useRef<Mesh>(null);
    const basisRef = useRef(createSkyViewBasis());
    const sunScreenRef = useRef(new Vector2(0, 0));
    const moonScreenRef = useRef(new Vector2(0, 0));
    const displayedGradientRef = useRef<SkyGradientColors | null>(null);
    const targetGradientRef = useRef<SkyGradientColors | null>(null);
    const backgroundRed = backgroundColor.r;
    const backgroundGreen = backgroundColor.g;
    const backgroundBlue = backgroundColor.b;

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

        return groundColor
            ? resolveGroundViewSkyGradientColors(gradient, groundColor)
            : gradient;
    }, [
        backgroundBlue,
        backgroundGreen,
        backgroundPaletteIndex,
        backgroundRed,
        groundColor,
        moonlight,
        timeOfDay,
        weather,
    ]);

    useEffect(() => {
        targetGradientRef.current = targetGradient;

        if (!displayedGradientRef.current || !animate) {
            displayedGradientRef.current =
                cloneSkyGradientColors(targetGradient);
            applyGradientUniforms(material, displayedGradientRef.current);
        }
    }, [animate, material, targetGradient]);

    useFrame((_, delta) => {
        const mesh = meshRef.current;
        if (!mesh || !updateSkyViewBasis(camera, basisRef.current)) {
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

        const sceneDate = timeOfDayToDate(currentTime, timeOfDay);
        const sun = SunCalc.getPosition(sceneDate, location.lat, location.lon);
        const moon = SunCalc.getMoonPosition(
            sceneDate,
            location.lat,
            location.lon,
        );
        const sunTuning = getSunViewportTuning(viewportWidth, viewportHeight);
        const sunDirection = altAzToScenePosition(
            sun.altitude,
            sun.azimuth,
        ).normalize();
        const moonDirection = altAzToScenePosition(
            moon.altitude,
            moon.azimuth,
        ).normalize();

        projectSkyDirectionToScreen(
            sunDirection,
            basis,
            {
                horizontalOffsetMultiplier:
                    sunTuning.horizontalOffsetMultiplier,
                screenOffsetMultiplier: SUN_SCREEN_OFFSET_MULTIPLIER,
                verticalOffsetMultiplier: sunTuning.verticalOffsetMultiplier,
            },
            sunScreenRef.current,
        );
        projectSkyDirectionToScreen(
            moonDirection,
            basis,
            {},
            moonScreenRef.current,
        );
        copyVectorUniform(material, 'uSunPosition', sunScreenRef.current);
        copyVectorUniform(material, 'uMoonPosition', moonScreenRef.current);

        const sunOpacity = smoothstep(
            HORIZON_FADE_START,
            HORIZON_FADE_END,
            degreesToRadians(sun.altitude),
        );
        const moonOpacity = smoothstep(
            HORIZON_FADE_START,
            HORIZON_FADE_END,
            degreesToRadians(moon.altitude),
        );

        const displayed = displayedGradientRef.current;
        const target = targetGradientRef.current;
        if (displayed && target) {
            if (animate) {
                lerpSkyGradientColors(
                    displayed,
                    target,
                    1 -
                        Math.exp(
                            -(1 / SKY_GRADIENT_TRANSITION_SECONDS) * delta,
                        ),
                );
            }

            const activeGradient = displayed;
            applyGradientUniforms(material, activeGradient);
            material.uniforms.uSunGlowIntensity.value =
                (groundColor ? 0 : activeGradient.sunGlowIntensity) *
                sunOpacity;
            material.uniforms.uMoonGlowIntensity.value =
                (groundColor ? 0 : activeGradient.moonGlowIntensity) *
                moonOpacity;
        }
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
