'use client';

import { useThree } from '@react-three/fiber';
import chroma from 'chroma-js';
import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import * as SunCalc from 'suncalc';
import {
    AdditiveBlending,
    Color,
    DoubleSide,
    type Mesh,
    ShaderMaterial,
} from 'three';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import { useSnapshotTime } from '../hooks/useSnapshotTime';
import { useGameState } from '../useGameState';
import { getMoonVisualPhase } from './moonPhase';
import {
    createSkyViewBasis,
    getSunViewportTuning,
    SKY_FORWARD_DISTANCE,
    SUN_SCREEN_OFFSET_MULTIPLIER,
    updateSkyViewBasis,
} from './skyProjection';
import {
    altAzToScenePosition,
    degreesToRadians,
    timeOfDayToDate,
} from './sunPosition';
import { visualDayNightTimes } from './visualDayNight';

// World-space size of the billboard planes. The visible disc is a fraction of
// this (see shader), leaving room around the disc for the soft glow to fade to
// zero before hitting the plane's square edge.
const SUN_PLANE_SIZE = 1.1;
const MOON_PLANE_SIZE = 0.85;

// Fade the body in/out near the horizon (in radians of altitude).
const HORIZON_FADE_START = -0.05;
const HORIZON_FADE_END = 0.18;

// Canvas-pixel size stays constant across zoom levels by counter-scaling the
// mesh by (REFERENCE_ZOOM / camera.zoom). REFERENCE_ZOOM matches the default
// game camera zoom so on-screen size matches the plane size at default zoom.
const SIZE_MULTIPLIER = 1.5;
const SUN_SIZE_MULTIPLIER = 0.8;

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
    .domain([
        visualDayNightTimes.sunrise,
        visualDayNightTimes.dawnLightEnd,
        visualDayNightTimes.dayStart,
        0.72,
        visualDayNightTimes.sunset,
        visualDayNightTimes.nightStart,
    ]);

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
    uniform float uBrightLimbAngle;
    uniform vec3 uColor;
    uniform float uOpacity;

    const float DISC_R = 0.42;
    const float GLOW_R = 0.95;
    const float TAU = 6.2831853;

    void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float d = length(p);

        // Terminator math in disc-local coords (rescale so disc edge is at 1)
        // with x aligned to the observer-relative bright limb direction.
        vec2 rp = p / DISC_R;
        float s = sin(uBrightLimbAngle);
        float c = cos(uBrightLimbAngle);
        float brightAxis = dot(rp, vec2(c, s));
        float crossAxis = dot(rp, vec2(-s, c));

        float term = cos(uPhase * TAU) * sqrt(max(0.0, 1.0 - crossAxis * crossAxis));
        float lit = smoothstep(term - 0.04, term + 0.04, brightAxis);

        float discEdge = smoothstep(DISC_R + 0.01, DISC_R - 0.01, d);
        // Glow follows the illuminated fraction so a thin crescent doesn't
        // project a full-moon halo.
        float illumFraction = 0.5 * (1.0 - cos(uPhase * TAU));
        float glow = smoothstep(GLOW_R, DISC_R, d) * 0.11 * illumFraction;

        float alpha = (lit * discEdge + glow) * uOpacity;
        if (alpha < 0.001) discard;
        gl_FragColor = vec4(uColor, alpha);
    }
`;

type SunMoonProps = {
    visibility?: number;
};

export function SunMoon({ visibility = 1 }: SunMoonProps) {
    const currentTime = useSnapshotTime();
    const timeOfDay = useGameState((state) => state.timeOfDay);
    const dayNightCycleDisabled = useGameState(
        (state) => state.dayNightCycleDisabled,
    );
    const gameCamera = useGameState((state) => state.gameCamera);
    const { data: garden } = useCurrentGarden();
    const camera = useThree((state) => state.camera);
    const { width: viewportWidth, height: viewportHeight } = useThree(
        (state) => state.size,
    );

    const location = useMemo(
        () => ({
            lat: garden?.location.lat ?? 45.739,
            lon: garden?.location.lon ?? 16.572,
        }),
        [garden],
    );
    const { lat, lon } = location;

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
                    uBrightLimbAngle: { value: 0 },
                    uColor: { value: new Color('#c8d8f2') },
                    uOpacity: { value: 0 },
                },
            }),
        [],
    );

    const sunViewportTuning = useMemo(
        () => getSunViewportTuning(viewportWidth, viewportHeight),
        [viewportHeight, viewportWidth],
    );

    const skyBasisRef = useRef(createSkyViewBasis());

    const updateSunMoon = useCallback(() => {
        if (!sunMesh.current || !moonMesh.current) return;

        if (!updateSkyViewBasis(camera, skyBasisRef.current)) return;

        const basis = skyBasisRef.current;
        const screenScale = basis.screenScale * SIZE_MULTIPLIER;
        sunMesh.current.scale.setScalar(
            screenScale *
                SUN_SIZE_MULTIPLIER *
                sunViewportTuning.sizeMultiplier,
        );
        moonMesh.current.scale.setScalar(screenScale);

        const date = timeOfDayToDate(currentTime, timeOfDay);
        const sun = SunCalc.getPosition(date, lat, lon);
        const moon = SunCalc.getMoonPosition(date, lat, lon);
        const moonVisualPhase = getMoonVisualPhase(date, { lat, lon });
        const sunAltitude = degreesToRadians(sun.altitude);
        const moonAltitude = degreesToRadians(moon.altitude);

        const sunOpacity =
            smoothstep(HORIZON_FADE_START, HORIZON_FADE_END, sunAltitude) *
            visibility;
        if (sunOpacity > 0.001) {
            const sunDir = altAzToScenePosition(
                sun.altitude,
                sun.azimuth,
            ).normalize();
            const sx = sunDir.dot(basis.right);
            const sy = sunDir.dot(basis.viewUp);

            sunMesh.current.position
                .copy(camera.position)
                .addScaledVector(basis.forward, SKY_FORWARD_DISTANCE)
                .addScaledVector(
                    basis.right,
                    sx *
                        basis.skyRadius *
                        SUN_SCREEN_OFFSET_MULTIPLIER *
                        sunViewportTuning.horizontalOffsetMultiplier,
                )
                .addScaledVector(
                    basis.viewUp,
                    sy *
                        basis.skyRadius *
                        SUN_SCREEN_OFFSET_MULTIPLIER *
                        sunViewportTuning.verticalOffsetMultiplier,
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
            moonAltitude,
        );
        // Fade the moon down while the sun is well above the horizon so it
        // reads as a pale daytime moon rather than a competing sun.
        const moonDayFade = 1 - 0.85 * smoothstep(-0.05, 0.3, sunAltitude);
        const moonOpacity = moonHorizonOpacity * moonDayFade * visibility;
        if (moonOpacity > 0.001) {
            const moonDir = altAzToScenePosition(
                moon.altitude,
                moon.azimuth,
            ).normalize();
            const mx = moonDir.dot(basis.right);
            const my = moonDir.dot(basis.viewUp);

            moonMesh.current.position
                .copy(camera.position)
                .addScaledVector(basis.forward, SKY_FORWARD_DISTANCE)
                .addScaledVector(basis.right, mx * basis.skyRadius)
                .addScaledVector(basis.viewUp, my * basis.skyRadius);
            moonMesh.current.lookAt(camera.position);

            moonMaterial.uniforms.uPhase.value = moonVisualPhase.phase;
            moonMaterial.uniforms.uBrightLimbAngle.value =
                moonVisualPhase.brightLimbAngle;
            moonMaterial.uniforms.uOpacity.value = moonOpacity;
            // Warm the tint toward white as the sun rises so the daytime moon
            // doesn't read as a cool blue spot against a bright sky.
            const dayBlend = dayNightCycleDisabled
                ? 1
                : smoothstep(-0.05, 0.3, sunAltitude);
            (moonMaterial.uniforms.uColor.value as Color)
                .copy(MOON_NIGHT_COLOR)
                .lerp(MOON_DAY_COLOR, dayBlend);
            moonMesh.current.visible = true;
        } else {
            moonMaterial.uniforms.uOpacity.value = 0;
            moonMesh.current.visible = false;
        }
    }, [
        camera,
        currentTime,
        dayNightCycleDisabled,
        lat,
        lon,
        moonMaterial,
        sunMaterial,
        sunViewportTuning.horizontalOffsetMultiplier,
        sunViewportTuning.sizeMultiplier,
        sunViewportTuning.verticalOffsetMultiplier,
        timeOfDay,
        visibility,
    ]);

    useLayoutEffect(() => {
        updateSunMoon();

        if (!gameCamera) {
            return;
        }

        return gameCamera.subscribe(() => updateSunMoon());
    }, [gameCamera, updateSunMoon]);

    return (
        <>
            <mesh
                ref={sunMesh}
                name="Environment:SunBillboard"
                frustumCulled={false}
                renderOrder={-1}
                material={sunMaterial}
            >
                <planeGeometry args={[SUN_PLANE_SIZE, SUN_PLANE_SIZE]} />
            </mesh>
            <mesh
                ref={moonMesh}
                name="Environment:MoonBillboard"
                frustumCulled={false}
                renderOrder={-1}
                material={moonMaterial}
            >
                <planeGeometry args={[MOON_PLANE_SIZE, MOON_PLANE_SIZE]} />
            </mesh>
        </>
    );
}
