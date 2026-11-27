'use client';

import { useEffect, useLayoutEffect, useMemo } from 'react';
import type { Color } from 'three';
import { useBlockData } from '../hooks/useBlockData';
import {
    limitRainSplashCount,
    rainSplashLook,
} from '../scene/Rain/rainParticles';
import {
    useSceneFixedTimeSeconds,
    useSceneTimeInvalidation,
    useSceneTimeUniform,
} from '../scene/SceneTime';
import type { Stack } from '../types/Stack';
import {
    createRainSplashCellTexture,
    createRainSplashMesh,
    createRainSplashUniforms,
} from './rainRippleMesh';
import { createRainSplashCells } from './rainRippleState';

/**
 * Splash rings where drops land on ground and bed soil (GAME_ART.md
 * "Weather > Rain and heavy rain"), placed in the vertex shader from the
 * garden's landing cells: one instanced draw, `count` rings at once.
 */
export function RainSplashes({
    capacity,
    count,
    edge,
    opacity,
    ring,
    stacks,
}: {
    capacity: number;
    count: number;
    edge: Color;
    opacity: number;
    ring: Color;
    stacks: Stack[] | undefined;
}) {
    const { data: blockData } = useBlockData();
    const time = useSceneTimeUniform();
    const fixedTime = useSceneFixedTimeSeconds();
    const cells = useMemo(
        () => createRainSplashCells(stacks ?? [], blockData ?? []),
        [blockData, stacks],
    );
    const cellTexture = useMemo(
        () => createRainSplashCellTexture(cells),
        [cells],
    );
    useEffect(() => () => cellTexture.texture.dispose(), [cellTexture]);
    const uniforms = useMemo(() => createRainSplashUniforms(), []);
    const mesh = useMemo(
        () =>
            createRainSplashMesh({
                capacity,
                cells: cellTexture,
                lifeSeconds: rainSplashLook.lifeSeconds,
                radius: rainSplashLook.radius,
                time,
                uniforms,
            }),
        [capacity, cellTexture, time, uniforms],
    );
    useEffect(
        () => () => {
            mesh.geometry.dispose();
            mesh.material.dispose();
        },
        [mesh],
    );

    const shown = Math.min(capacity, limitRainSplashCount(count, cells.length));
    const visible = shown > 0 && opacity > 0.001;
    useSceneTimeInvalidation(
        'rain-splashes',
        visible && fixedTime === undefined,
    );
    useLayoutEffect(() => {
        mesh.geometry.instanceCount = shown;
        mesh.name = `Weather:RainSplashes:count:${shown}`;
        uniforms.uAlpha.value = opacity;
        uniforms.uColor.value.copy(ring);
        uniforms.uEdge.value.copy(edge);
    }, [edge, mesh, opacity, ring, shown, uniforms]);

    return <primitive object={mesh} visible={visible} />;
}
