'use client';

import { useFrame } from '@react-three/fiber';
import chroma from 'chroma-js';
import { useMemo, useRef } from 'react';
import { getMoonIllumination, getMoonPosition, getPosition } from 'suncalc';
import {
    AdditiveBlending,
    Color,
    DoubleSide,
    type Mesh,
    type OrthographicCamera,
    ShaderMaterial,
    Vector3,
} from 'three';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import { useGameState } from '../useGameState';
import { altAzToScenePosition, timeOfDayToDate } from './Environment';

// World-space size of the billboard planes. The visible disc is a fraction of
// this (see shader), leaving room around the disc for the soft glow to fade to
// zero before hitting the plane's square edge.
const SUN_PLANE_SIZE = 1.1;
const MOON_PLANE_SIZE = 0.85;

// Fade the body in/out near the horizon (in radians of altitude).
const HORIZON_FADE_START = -0.05;
const HORIZON_FADE_END = 0.18;

// Distance in front of the camera along its forward axis. Large enough that
// the discs sit deeper than scene geometry, so depthTest lets blocks occlude
// them naturally.
const FORWARD_DISTANCE = 500;

// Fraction of the viewport half-height used as the "sky" radius; zenith lands
// slightly above the top edge, horizon sits near the middle where the ground
// meets the sky in our isometric view.
const SKY_SCREEN_FRACTION = 1.05;

// Canvas-pixel size stays constant across zoom levels by counter-scaling the
// mesh by (REFERENCE_ZOOM / camera.zoom). REFERENCE_ZOOM matches the default
// game camera zoom so on-screen size matches the plane size at default zoom.
const REFERENCE_ZOOM = 100;
const SIZE_MULTIPLIER = 1.5;
const SUN_SIZE_MULTIPLIER = 0.8;
const SUN_SCREEN_OFFSET_MULTIPLIER = 0.8;

const MOON_NIGHT_COLOR = new Color('#c8d8f2');
const MOON_DAY_COLOR = new Color('#f4f2ec');

const sunColorScale = chroma
    .scale([
        chroma.temperature(2200),
        chroma.temperature(3500),
        chroma.temperature(5800),
        chroma.temperature(5800),
        chroma.temperature(3500),
        chroma.temperature(2200),
    ])
    .domain([0.2, 0.23, 0.28, 0.72, 0.77, 0.8]);

function smoothstep(edge0: number, edge1: number, x: number) {
    const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}

const bodyVertex = /* glsl */ `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

// p is in plane-local coords where the full plane spans [-1, 1]. The disc
// occupies d < DISC_R and the soft glow fades out before reaching the plane
// edge so the square geometry never shows through.
const sunFragment = /* glsl */ `
    varying vec2 vUv;
    uniform vec3 uColor;
    uniform float uOpacity;

    const float DISC_R = 0.32;
    const float GLOW_R = 0.9;

    void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float d = length(p);
        float disc = smoothstep(DISC_R + 0.02, DISC_R - 0.02, d);
        float glow = smoothstep(GLOW_R, DISC_R, d) * 0.22;
        float alpha = clamp(disc + glow, 0.0, 1.0) * uOpacity;
        if (alpha < 0.001) discard;
        gl_FragColor = vec4(uColor, alpha);
    }
`;

const moonFragment = /* glsl */ `
    varying vec2 vUv;
    uniform float uPhase;
    uniform float uAngle;
    uniform vec3 uColor;
    uniform float uOpacity;

    const float DISC_R = 0.42;
    const float GLOW_R = 0.95;

    void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float d = length(p);

        // Terminator math in disc-local coords (rescale so disc edge is at 1).
        vec2 rp = p / DISC_R;
        float s = sin(uAngle);
        float c = cos(uAngle);
        rp = vec2(rp.x * c - rp.y * s, rp.x * s + rp.y * c);

        float term = cos(uPhase * 6.2831853) * sqrt(max(0.0, 1.0 - rp.y * rp.y));
        float lit;
        if (uPhase < 0.5) {
            lit = smoothstep(term - 0.04, term + 0.04, rp.x);
        } else {
            lit = smoothstep(-term + 0.04, -term - 0.04, rp.x);
        }

        float discEdge = smoothstep(DISC_R + 0.01, DISC_R - 0.01, d);
        // Glow follows the illuminated fraction so a thin crescent doesn't
        // project a full-moon halo.
        float illumFraction = 0.5 * (1.0 - cos(uPhase * 6.2831853));
        float glow = smoothstep(GLOW_R, DISC_R, d) * 0.18 * illumFraction;

        float alpha = (lit * discEdge + glow) * uOpacity;
        if (alpha < 0.001) discard;
        gl_FragColor = vec4(uColor, alpha);
    }
`;

type SunMoonProps = {
    visibility?: number;
};

export function SunMoon({ visibility = 1 }: SunMoonProps) {
    const currentTime = useGameState((state) => state.currentTime);
    const timeOfDay = useGameState((state) => state.timeOfDay);
    const dayNightCycleDisabled = useGameState(
        (state) => state.dayNightCycleDisabled,
    );
    const { data: garden } = useCurrentGarden();

    const location = useMemo(
        () => ({
            lat: garden?.location.lat ?? 45.739,
            lon: garden?.location.lon ?? 16.572,
        }),
        [garden],
    );

    const sunMesh = useRef<Mesh>(null);
    const moonMesh = useRef<Mesh>(null);

    const sunMaterial = useMemo(
        () =>
            new ShaderMaterial({
                vertexShader: bodyVertex,
                fragmentShader: sunFragment,
                transparent: true,
                depthWrite: false,
                side: DoubleSide,
                blending: AdditiveBlending,
                uniforms: {
                    uColor: { value: new Color('#fff2c4') },
                    uOpacity: { value: 0 },
                },
            }),
        [],
    );

    const moonMaterial = useMemo(
        () =>
            new ShaderMaterial({
                vertexShader: bodyVertex,
                fragmentShader: moonFragment,
                transparent: true,
                depthWrite: false,
                side: DoubleSide,
                uniforms: {
                    uPhase: { value: 0 },
                    uAngle: { value: 0 },
                    uColor: { value: new Color('#c8d8f2') },
                    uOpacity: { value: 0 },
                },
            }),
        [],
    );

    const forwardRef = useRef(new Vector3());
    const rightRef = useRef(new Vector3());
    const viewUpRef = useRef(new Vector3());

    useFrame(({ camera }) => {
        if (!sunMesh.current || !moonMesh.current) return;

        const orthographic = camera as OrthographicCamera;
        if (!orthographic.isOrthographicCamera) return;

        camera.getWorldDirection(forwardRef.current);
        rightRef.current
            .crossVectors(forwardRef.current, camera.up)
            .normalize();
        viewUpRef.current
            .crossVectors(rightRef.current, forwardRef.current)
            .normalize();

        const halfHeight = orthographic.top / orthographic.zoom;
        const skyRadius = halfHeight * SKY_SCREEN_FRACTION;
        const screenScale =
            (REFERENCE_ZOOM / orthographic.zoom) * SIZE_MULTIPLIER;
        sunMesh.current.scale.setScalar(screenScale * SUN_SIZE_MULTIPLIER);
        moonMesh.current.scale.setScalar(screenScale);

        const date = timeOfDayToDate(currentTime, timeOfDay);
        const sun = getPosition(date, location.lat, location.lon);
        const moon = getMoonPosition(date, location.lat, location.lon);
        const illumination = getMoonIllumination(date);

        const sunOpacity =
            smoothstep(HORIZON_FADE_START, HORIZON_FADE_END, sun.altitude) *
            visibility;
        if (sunOpacity > 0.001) {
            const sunDir = altAzToScenePosition(
                sun.altitude,
                sun.azimuth,
            ).normalize();
            const sx = sunDir.dot(rightRef.current);
            const sy = sunDir.dot(viewUpRef.current);

            sunMesh.current.position
                .copy(camera.position)
                .addScaledVector(forwardRef.current, FORWARD_DISTANCE)
                .addScaledVector(
                    rightRef.current,
                    sx * skyRadius * SUN_SCREEN_OFFSET_MULTIPLIER,
                )
                .addScaledVector(
                    viewUpRef.current,
                    sy * skyRadius * SUN_SCREEN_OFFSET_MULTIPLIER,
                );
            sunMesh.current.lookAt(camera.position);

            const sunRgb = sunColorScale(timeOfDay).rgb();
            (sunMaterial.uniforms.uColor.value as Color).setRGB(
                sunRgb[0] / 255,
                sunRgb[1] / 255,
                sunRgb[2] / 255,
            );
            sunMaterial.uniforms.uOpacity.value = sunOpacity;
            sunMesh.current.visible = true;
        } else {
            sunMaterial.uniforms.uOpacity.value = 0;
            sunMesh.current.visible = false;
        }

        const moonHorizonOpacity = smoothstep(
            HORIZON_FADE_START,
            HORIZON_FADE_END,
            moon.altitude,
        );
        // Fade the moon down while the sun is well above the horizon so it
        // reads as a pale daytime moon rather than a competing sun.
        const moonDayFade = 1 - 0.85 * smoothstep(-0.05, 0.3, sun.altitude);
        const moonOpacity = moonHorizonOpacity * moonDayFade * visibility;
        if (moonOpacity > 0.001) {
            const moonDir = altAzToScenePosition(
                moon.altitude,
                moon.azimuth,
            ).normalize();
            const mx = moonDir.dot(rightRef.current);
            const my = moonDir.dot(viewUpRef.current);

            moonMesh.current.position
                .copy(camera.position)
                .addScaledVector(forwardRef.current, FORWARD_DISTANCE)
                .addScaledVector(rightRef.current, mx * skyRadius)
                .addScaledVector(viewUpRef.current, my * skyRadius);
            moonMesh.current.lookAt(camera.position);

            moonMaterial.uniforms.uPhase.value = illumination.phase;
            moonMaterial.uniforms.uAngle.value = illumination.angle;
            moonMaterial.uniforms.uOpacity.value = moonOpacity;
            // Warm the tint toward white as the sun rises so the daytime moon
            // doesn't read as a cool blue spot against a bright sky.
            const dayBlend = dayNightCycleDisabled
                ? 1
                : smoothstep(-0.05, 0.3, sun.altitude);
            (moonMaterial.uniforms.uColor.value as Color)
                .copy(MOON_NIGHT_COLOR)
                .lerp(MOON_DAY_COLOR, dayBlend);
            moonMesh.current.visible = true;
        } else {
            moonMaterial.uniforms.uOpacity.value = 0;
            moonMesh.current.visible = false;
        }
    });

    return (
        <>
            <mesh
                ref={sunMesh}
                frustumCulled={false}
                renderOrder={-1}
                material={sunMaterial}
            >
                <planeGeometry args={[SUN_PLANE_SIZE, SUN_PLANE_SIZE]} />
            </mesh>
            <mesh
                ref={moonMesh}
                frustumCulled={false}
                renderOrder={-1}
                material={moonMaterial}
            >
                <planeGeometry args={[MOON_PLANE_SIZE, MOON_PLANE_SIZE]} />
            </mesh>
        </>
    );
}
