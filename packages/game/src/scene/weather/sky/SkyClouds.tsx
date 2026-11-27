'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
    Color,
    Mesh,
    type Object3D,
    PlaneGeometry,
    SRGBColorSpace,
    Vector2,
    Vector3,
} from 'three';
import { updateGameProfileMetadata } from '../../gameProfileMetadata';
import {
    sceneFrameRates,
    useSceneFixedTimeSeconds,
    useSceneTimeInvalidation,
    useSceneTimeUniform,
} from '../../SceneTime';
import {
    isWeatherLayerHidden,
    useWeatherFrame,
    type WeatherFrame,
} from '../WeatherFrameContext';
import { createCloudDriftTravel, stepCloudDriftTravel } from '../windClass';
import {
    bandCloudCapacity,
    bandCloudOrder,
    cloudBandRules,
    createBandCloudShapes,
    placeBandCloud,
    resolveBandCloudWant,
    resolveCloudHaze,
    stepBandCloudPresence,
} from './cloudBand';
import {
    type CloudBandPassUniforms,
    cloudBandOctaves,
    cloudBandRenderOrder,
    createCloudBandMaterial,
    createCloudBandUniforms,
} from './cloudBandMaterial';
import { resolveWeatherCloudDrift } from './cloudDrift';
import { getSkyCloudGlowUniforms } from './skyCloudMaterial';
import {
    applyWeatherSkyGrey,
    resolveWeatherSkyGrey,
    type WeatherSkyGrey,
} from './skyGrey';

/** The band's seed (the target's default). */
const cloudBandSeed = 1;

/** Cover at which the first band cloud joins. */
const firstBandCloudCover = bandCloudOrder[0]?.[0] ?? 0.05;

/**
 * Profile counts: every cloud is a band cloud; the deck reports how much of
 * it shows (0 to 1).
 */
function reportClouds(clouds: number, deck: number) {
    updateGameProfileMetadata({
        cloudDeckAmount: Math.round(deck * 100) / 100,
        cloudVisualCount: clouds,
    });
}

/**
 * The cloud band (GAME_ART.md "Weather > Clouds and overcast", user
 * feedback 2026-11-24): soft, misty clouds only in a band across the top of
 * the view, the continuous overcast deck from cloudy 0.8 and a faint haze
 * toward the cloud tone at the top of the sky. One screen-space shader in
 * two passes (`cloudBandMaterial.ts`): over the sky, and translucent where
 * the band hangs over a garden that fills the view. Clouds keep their pixel
 * size at any zoom, drift sideways at their own speeds, fade and grow in
 * over 1.5 s (250 ms and no drift under reduced motion). Off in the avatar
 * views and with `hideWeather=sky`.
 */
export function SkyClouds() {
    const frame = useWeatherFrame();
    const hidden =
        isWeatherLayerHidden(frame, 'sky') ||
        frame.cameraMode !== 'orthographic' ||
        !frame.skyLayout;
    if (hidden) {
        return <SkyCloudsOff />;
    }
    return <CloudBand frame={frame} />;
}

function SkyCloudsOff() {
    useEffect(() => {
        reportClouds(0, 0);
    }, []);
    return null;
}

/** sRGB components of a linear colour, as the band shader takes them. */
function writeSrgb(target: Vector3, color: Color, scratch: Color) {
    scratch.copy(color);
    const rgb = { r: 0, g: 0, b: 0 };
    scratch.getRGB(rgb, SRGBColorSpace);
    target.set(rgb.r, rgb.g, rgb.b);
}

/** `writeSrgb` of a role after the rain and storm grey. */
function writeGreyedSrgb(
    target: Vector3,
    color: Color,
    grey: WeatherSkyGrey,
    scratch: { color: Color; tone: Color },
) {
    applyWeatherSkyGrey(scratch.tone.copy(color), grey);
    writeSrgb(target, scratch.tone, scratch.color);
}

function CloudBand({ frame }: { frame: WeatherFrame }) {
    const camera = useThree((state) => state.camera);
    const scene = useThree((state) => state.scene);
    const gl = useThree((state) => state.gl);
    const timeUniform = useSceneTimeUniform();
    const fixedTimeSeconds = useSceneFixedTimeSeconds();
    const frozen = fixedTimeSeconds !== undefined;
    const tier = frame.caps.tier;
    const cap = frame.caps.bandClouds;
    const octaves = cloudBandOctaves[tier];

    const shapes = useMemo(() => createBandCloudShapes(cloudBandSeed), []);
    const uniforms = useMemo(
        () => createCloudBandUniforms(shapes, cloudBandSeed),
        [shapes],
    );
    const geometry = useMemo(() => new PlaneGeometry(2, 2), []);
    const passes = useMemo(() => {
        const make = (overGarden: boolean) => {
            const { material, uniforms: passUniforms } =
                createCloudBandMaterial(uniforms, {
                    clouds: cap,
                    octaves,
                    overGarden,
                });
            const mesh = new Mesh(geometry, material);
            mesh.name = overGarden
                ? 'Weather:CloudBandOverGarden'
                : 'Weather:CloudBand';
            mesh.frustumCulled = false;
            mesh.renderOrder = cloudBandRenderOrder;
            mesh.visible = false;
            mesh.raycast = () => {};
            return { mesh, material, uniforms: passUniforms };
        };
        return [make(false), make(true)] as const;
    }, [cap, geometry, octaves, uniforms]);
    useEffect(
        () => () => {
            for (const pass of passes) pass.material.dispose();
        },
        [passes],
    );
    useEffect(() => () => geometry.dispose(), [geometry]);

    const frameRef = useRef(frame);
    frameRef.current = frame;
    // The drift the cloud shadows share: px per second along screen x.
    const driftRef = useRef(0);
    driftRef.current = resolveWeatherCloudDrift(frame).bandPxPerSecond;
    const travel = useMemo(createCloudDriftTravel, []);
    const motionState = useRef({
        presence: new Float32Array(bandCloudCapacity),
        deck: 0,
        reported: -1,
        reportedDeck: -1,
    });
    const scratch = useMemo(
        () => ({
            color: new Color(),
            tone: new Color(),
            grey: { amount: 0, tint: new Color() },
            glow: new Vector3(),
            size: new Vector2(),
            sun: new Vector3(),
            bodies: [] as Object3D[],
            bodySearchAt: Number.NEGATIVE_INFINITY,
        }),
        [],
    );

    // Fades need frames until they settle; drift needs them while clouds
    // or the deck show (not under reduced motion, where nothing drifts).
    const layout = frame.skyLayout;
    const cover = layout?.cover ?? 0;
    const showing =
        cover >= firstBandCloudCover || (layout?.cloudBand.deck ?? 0) > 0;
    const [settling, setSettling] = useState(true);
    const settlingRef = useRef(true);
    // biome-ignore lint/correctness/useExhaustiveDependencies: a new layout, tier or motion setting retargets the fades.
    useLayoutEffect(() => {
        if (!settlingRef.current) {
            settlingRef.current = true;
            setSettling(true);
        }
    }, [cap, frame.reducedMotion, layout]);
    useSceneTimeInvalidation(
        'sky-clouds',
        !frozen && ((showing && !frame.reducedMotion) || settling),
        sceneFrameRates.ambient,
    );

    useFrame((_, delta) => {
        const current = frameRef.current;
        const sky = current.skyLayout;
        const [skyPass, overPass] = passes;
        if (!sky) {
            skyPass.mesh.visible = false;
            overPass.mesh.visible = false;
            return;
        }
        const band = sky.cloudBand;
        const { amounts, reducedMotion, roles } = current;
        const seconds = timeUniform.value;
        const motion = reducedMotion ? 0 : 1;
        const step = { frozen, reducedMotion };

        // Colours: the roles, as sRGB, mixed in sRGB like the target. Rain
        // and storm at high cover grey them, and the haze with them, like
        // the sky gradient behind (`skyGrey.ts`).
        const grey = resolveWeatherSkyGrey(amounts, roles.time, scratch.grey);
        writeGreyedSrgb(uniforms.uLit.value, roles.cloudLit, grey, scratch);
        writeGreyedSrgb(uniforms.uShade.value, roles.cloudShade, grey, scratch);
        writeGreyedSrgb(uniforms.uRim.value, roles.cloudRim, grey, scratch);
        uniforms.uHazeColor.value
            .copy(uniforms.uLit.value)
            .lerp(uniforms.uShade.value, 0.45);
        uniforms.uGrey.value =
            cloudBandRules.rainGrey *
            Math.min(1, Math.max(0, amounts.rainy)) *
            (1 - 0.4 * Math.min(1, Math.max(0, amounts.storm)));

        // The view, in CSS px and drawing-buffer px per CSS px.
        const widthPx = Math.max(1, band.widthPx);
        const heightPx = Math.max(1, band.heightPx);
        uniforms.uView.value.set(widthPx, heightPx);
        gl.getDrawingBufferSize(scratch.size);
        uniforms.uPixelRatio.value = scratch.size.y / heightPx;
        uniforms.uTime.value = seconds * motion;

        // The band's lower limit per column (a new layout writes it).
        band.limitsPx.forEach((limit, column) => {
            uniforms.uLimit.value[column >> 2]?.setComponent(column & 3, limit);
        });

        // The deck: fades in and grows down as cover passes 0.62 to 0.86.
        const state = motionState.current;
        state.deck = stepBandCloudPresence(state.deck, band.deck, delta, step);
        uniforms.uDeck.value = state.deck ** 0.6;
        uniforms.uDeckGrow.value = state.deck;
        // Drift: the band's travel along screen x, the way the cloud
        // shadows go. The deck samples x + scroll, so it scrolls back.
        const travelPx = stepCloudDriftTravel(
            travel,
            seconds,
            driftRef.current,
            frozen,
        );
        uniforms.uDeckScroll.value = -travelPx;

        // Haze toward the cloud tone at the top of the sky.
        const haze = resolveCloudHaze(sky.cover);
        uniforms.uHaze.value = haze;
        uniforms.uHazeFull.value = 1 - band.sharePx / heightPx;

        // Separate clouds: seeded shapes drifting along the band.
        const thunder = amounts.thundery > 0;
        let visible = 0;
        let settled = Math.abs(state.deck - band.deck) < 1e-3;
        for (let index = 0; index < bandCloudCapacity; index += 1) {
            const shape = shapes[index];
            const position = uniforms.uCloudPos.value[index];
            if (!shape || !position) continue;
            const want = resolveBandCloudWant({
                cap,
                cover: sky.cover,
                index,
                thunder,
            });
            const presence = stepBandCloudPresence(
                state.presence[index] ?? 0,
                want,
                delta,
                step,
            );
            state.presence[index] = presence;
            if (Math.abs(presence - want) > 1e-3) settled = false;
            const placement =
                index < cap
                    ? placeBandCloud(shape, band, {
                          presence,
                          reducedMotion,
                          travelPx,
                      })
                    : null;
            if (!placement) {
                position.set(0, 0, 1, 0);
                continue;
            }
            position.set(
                placement.x,
                placement.base,
                placement.scale,
                placement.alpha,
            );
            visible += 1;
        }

        // The sun or moon on screen: clouds are lit from its side.
        if (
            scratch.bodies.length === 0 &&
            Math.abs(seconds - scratch.bodySearchAt) > 2
        ) {
            scratch.bodySearchAt = seconds;
            for (const name of [
                'Environment:SunBillboard',
                'Environment:MoonBillboard',
            ]) {
                const body = scene.getObjectByName(name);
                if (body) scratch.bodies.push(body);
            }
        }
        const body = scratch.bodies.find(
            (object) => object.visible && object.parent,
        );
        if (body) {
            body.getWorldPosition(scratch.sun).project(camera);
            uniforms.uSunPx.value.set(
                ((scratch.sun.x + 1) / 2) * widthPx,
                ((1 - scratch.sun.y) / 2) * heightPx,
            );
        } else {
            uniforms.uSunPx.value.set(0.1 * widthPx, 0.14 * heightPx);
        }

        // The bolt's glow (WP5 writes it in world space).
        const glow = getSkyCloudGlowUniforms();
        uniforms.uGlow.value = glow.uGlow.value;
        if (glow.uGlow.value > 0) {
            scratch.glow.copy(glow.uGlowPos.value).project(camera);
            const zoom = Math.max(1e-6, Reflect.get(camera, 'zoom') ?? 1);
            uniforms.uGlowPos.value.set(
                ((scratch.glow.x + 1) / 2) * widthPx,
                ((1 - scratch.glow.y) / 2) * heightPx,
                glow.uGlowRadius.value * zoom,
            );
            writeSrgb(
                uniforms.uGlowColor.value,
                glow.uGlowColor.value,
                scratch.color,
            );
        }

        // Each pass covers only its rows: the band, and in the sky pass the
        // haze down to mid-screen.
        const bandBottomPx = Math.min(heightPx, band.maxLimitPx + 4);
        const bandBottomNdc = 1 - (2 * bandBottomPx) / heightPx;
        const anyCloud = visible > 0 || state.deck > 0.001;
        setPass(
            skyPass.uniforms,
            haze > 0.001 ? Math.min(0, bandBottomNdc) : bandBottomNdc,
        );
        setPass(overPass.uniforms, bandBottomNdc);
        skyPass.mesh.visible = anyCloud || haze > 0.001;
        overPass.mesh.visible = anyCloud && band.overGardenPx > 0;

        if (
            visible !== state.reported ||
            Math.abs(state.deck - state.reportedDeck) > 0.05
        ) {
            state.reported = visible;
            state.reportedDeck = state.deck;
            reportClouds(visible, state.deck);
        }
        if (settled && settlingRef.current) {
            settlingRef.current = false;
            setSettling(false);
        }
    });

    useEffect(() => () => reportClouds(0, 0), []);

    return (
        <>
            <primitive object={passes[0].mesh} dispose={null} />
            <primitive object={passes[1].mesh} dispose={null} />
        </>
    );
}

function setPass(uniforms: CloudBandPassUniforms, bottomNdc: number) {
    uniforms.uBottomNdc.value = bottomNdc;
}
