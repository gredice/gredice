'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Mesh } from 'three';
import { updateGameProfileMetadata } from '../../gameProfileMetadata';
import {
    useSceneDeadline,
    useSceneFixedTimeSeconds,
    useSceneRenderRequest,
    useSceneTimeInvalidation,
    useSceneTimeUniform,
} from '../../SceneTime';
import { viewToWorld } from '../skyLayout';
import type { WeatherFrame } from '../WeatherFrameContext';
import {
    resolveWindSwooshAmount,
    resolveWindSwooshCount,
    resolveWindVector,
} from '../windClass';
import {
    type DrawingSwoosh,
    findNextSwooshStart,
    findSwooshSpot,
    resolveDrawingSwooshes,
    resolveSwooshFlip,
    resolveSwooshScale,
    type SwooshSpot,
    windSwooshRules,
} from './windSwooshLayout';
import {
    createWindSwooshGeometry,
    createWindSwooshMaterial,
} from './windSwooshMesh';

/** World height of the swoosh plane: in the sky, in front of the garden. */
const swooshAltitude = 3;

/**
 * The shader counts time from an epoch that steps every 10 minutes, so the
 * scene seconds it subtracts stay small enough for float precision.
 */
const swooshEpochSeconds = 600;

/**
 * Curly wind swooshes in free sky (GAME_ART.md "Weather > Wind"): from wind
 * class 1.3, at most 4 / 2 / 1 by tier, faded by rain and snow. One
 * instanced draw; each swoosh picks a free spot once per cycle and the
 * vertex shader runs the draw-on and the drift from the scene clock.
 *
 * Leases: the layer renders continuously only while a swoosh is drawing on
 * screen. Between swooshes, and on a view the garden fills (no free sky), a
 * deadline wakes it for the next cycle that finds a spot, so it holds no
 * render lease while nothing shows.
 */
export function WindSwooshes({ frame }: { frame: WeatherFrame }) {
    const { amounts, caps, reducedMotion, skyLayout, view, footprint } = frame;
    const capacity = caps.swooshes;
    const count = Math.min(
        resolveWindSwooshCount(amounts.windClass, capacity),
        capacity,
    );
    const amount = resolveWindSwooshAmount(amounts.windClass, {
        rainy: amounts.rainy,
        snowy: amounts.snowy,
    });
    const active =
        count > 0 &&
        amount > 0.01 &&
        view !== null &&
        skyLayout !== null &&
        footprint !== null;
    const flip = view
        ? resolveSwooshFlip(
              resolveWindVector(amounts.windDirection),
              view.basis.right,
          )
        : 1;

    const fixedTimeSeconds = useSceneFixedTimeSeconds();
    const frozen = fixedTimeSeconds !== undefined;
    const time = useSceneTimeUniform();
    const requestRender = useSceneRenderRequest();

    const [drawing, setDrawing] = useState(false);
    const [wakeAtMs, setWakeAtMs] = useState<number | null>(null);
    useSceneTimeInvalidation(
        'weather-wind-swooshes',
        active && drawing && !frozen,
    );
    useSceneDeadline({
        callback: () => {
            setWakeAtMs(null);
            requestRender('weather-wind-swooshes-next');
        },
        deadlineMs: wakeAtMs,
        enabled: active && !drawing && !frozen,
        owner: 'weather-wind-swooshes-next',
    });

    const geometry = useMemo(
        () => createWindSwooshGeometry(capacity),
        [capacity],
    );
    const material = useMemo(() => createWindSwooshMaterial(), []);
    const mesh = useMemo(() => {
        const value = new Mesh(geometry, material);
        value.name = 'Weather:WindSwooshes';
        value.frustumCulled = false;
        value.renderOrder = 22;
        value.visible = false;
        value.raycast = () => {};
        return value;
    }, [geometry, material]);
    useEffect(() => () => geometry.dispose(), [geometry]);
    useEffect(() => () => material.dispose(), [material]);
    // Swooshes this layer cycles through (each shows only where free sky
    // has room for it).
    const cycledCount = active ? count : 0;
    useEffect(() => {
        updateGameProfileMetadata({ windSwooshCount: cycledCount });
    }, [cycledCount]);
    useEffect(
        () => () => updateGameProfileMetadata({ windSwooshCount: 0 }),
        [],
    );

    const { windSwoosh } = frame.roles;
    useEffect(() => {
        material.uniforms.uColor.value.copy(windSwoosh);
        material.uniforms.uAmount.value = amount;
        material.uniforms.uReduced.value = reducedMotion ? 1 : 0;
        requestRender('weather-wind-swooshes-change');
    }, [amount, material, reducedMotion, requestRender, windSwoosh]);

    // Spots found per swoosh and cycle, and what the attribute holds. A new
    // layout, footprint, sky props, view, wind direction, count or motion
    // setting starts both afresh.
    // biome-ignore lint/correctness/useExhaustiveDependencies: these inputs change every spot, so they reset the cache.
    const plan = useMemo(
        () => ({
            spots: new Map<
                number,
                { cycle: number; spot: SwooshSpot | null }
            >(),
            written: '',
        }),
        [
            count,
            flip,
            footprint,
            frame.skyProps,
            geometry,
            reducedMotion,
            skyLayout,
            view,
        ],
    );
    // The same inputs, or the layer turning on, also re-plan the next wake.
    // biome-ignore lint/correctness/useExhaustiveDependencies: a new plan or the layer turning on needs one frame to plan the next wake.
    useEffect(() => {
        setWakeAtMs(null);
        requestRender('weather-wind-swooshes-plan');
    }, [plan, active, requestRender]);

    const frameRef = useRef(frame);
    frameRef.current = frame;

    const hide = () => {
        if (mesh.visible) mesh.visible = false;
        geometry.instanceCount = 0;
        plan.written = '';
    };

    const writeSwooshes = (
        shown: readonly DrawingSwoosh[],
        scale: number,
        epoch: number,
    ) => {
        const key = `${epoch}:${scale}:${shown
            .map((item) => `${item.index}.${item.cycle}`)
            .join(',')}`;
        if (key === plan.written) return;
        plan.written = key;
        const place = geometry.getAttribute('aPlace');
        shown.forEach((item, slot) => {
            place.setXYZW(
                slot,
                item.spot.u,
                item.spot.v,
                scale,
                item.start - epoch,
            );
        });
        place.needsUpdate = shown.length > 0;
        geometry.instanceCount = shown.length;
    };

    useFrame(() => {
        const current = frameRef.current;
        const currentView = current.view;
        const layout = current.skyLayout;
        const obstacles = current.footprint;
        if (!active || !currentView || !layout || !obstacles) {
            hide();
            return;
        }
        const t = time.value;
        const { basis, pixelsPerUnit } = currentView;
        const spotInput = {
            flip,
            obstacles,
            // The band, the bolts and the sky mist rolls.
            placed: current.skyProps.reserved,
            reducedMotion,
            view: currentView,
        };
        const shown = resolveDrawingSwooshes(
            t,
            count,
            (index, cycle, taken) => {
                const cached = plan.spots.get(index);
                if (cached && cached.cycle === cycle) return cached.spot;
                const spot = findSwooshSpot({
                    ...spotInput,
                    cycle,
                    index,
                    taken,
                });
                plan.spots.set(index, { cycle, spot });
                return spot;
            },
        );

        const epoch = Math.floor(t / swooshEpochSeconds) * swooshEpochSeconds;
        writeSwooshes(shown, resolveSwooshScale(pixelsPerUnit), epoch);
        const uniforms = material.uniforms;
        uniforms.uTime.value = t - epoch;
        uniforms.uTravel.value = reducedMotion
            ? 0
            : windSwooshRules.travelPx / pixelsPerUnit;
        // The view axis at sky-prop height (the basis origin is the camera
        // itself, which the near plane would clip).
        viewToWorld(basis, 0, 0, swooshAltitude, uniforms.uCenter.value);
        uniforms.uAxisRight.value.set(
            basis.right.x,
            basis.right.y,
            basis.right.z,
        );
        uniforms.uAxisUp.value.set(basis.up.x, basis.up.y, basis.up.z);
        uniforms.uFlip.value = flip;
        mesh.visible = shown.length > 0;

        if (frozen) return;
        const isDrawing = shown.length > 0;
        if (isDrawing !== drawing) setDrawing(isDrawing);
        if (isDrawing) {
            if (wakeAtMs !== null) setWakeAtMs(null);
            return;
        }
        if (wakeAtMs === null) {
            const next = findNextSwooshStart({ ...spotInput, count, t });
            setWakeAtMs(
                performance.now() + Math.max(0, next.time - t) * 1000 + 10,
            );
        }
    });

    return <primitive object={mesh} dispose={null} />;
}
