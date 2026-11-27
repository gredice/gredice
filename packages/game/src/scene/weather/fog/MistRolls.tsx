'use client';

import { useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import {
    InstancedBufferAttribute,
    InstancedMesh,
    Matrix4,
    Quaternion,
    Vector3,
} from 'three';
import { resolveTerrainRimPlacements } from '../../../entities/terrainRim/terrainRimPlacements';
import type { Stack } from '../../../types/Stack';
import { resolveIslandFoggy } from '../../atmosphereLighting';
import type { SceneBlockData } from '../../SceneBlockDataContext';
import { useSceneRenderRequest, useSceneTimeUniform } from '../../SceneTime';
import { viewToWorld } from '../skyLayout';
import { useWeatherFrame } from '../WeatherFrameContext';
import { createMistRollGeometry } from './mistRollGeometry';
import {
    type MistRoll,
    mistRollRules,
    resolveMistRimRolls,
    resolveMistRimRuns,
    resolveMistRollAmount,
} from './mistRollLayout';
import {
    createMistRollMaterial,
    mistRollMaterialRules,
} from './mistRollMaterial';

/** Most rolls the mesh holds: every rim and sky roll on high. */
const rollCapacity = 16;

export type MistRollStats = {
    rimRolls: number;
    skyRolls: number;
    rimRuns: number;
    triangles: number;
    /** How far the top band reaches down (CSS px), or null with no band. */
    bandReachPx: number | null;
    /** Each sky roll's box in CSS px from the top-left: x0, y0, x1, y1. */
    skyRollBoxesPx: number[][];
};

/**
 * Mist rolls (GAME_ART.md "Weather > Fog and mist"): long, low, soft mist
 * banks along the outer terrain rim (a ground effect, also in the avatar
 * views) and in free sky (a sky prop, orthographic view only), drawn with
 * the band clouds' analytic soft falloff (`mistRollMaterial.ts`). One
 * instanced draw of quads for every roll; the slide and bob run in the
 * vertex shader on the scene clock, so the CPU only places rolls when the
 * garden or view changes.
 */
export function MistRolls({
    blockData,
    onStats,
    stacks,
}: {
    blockData: SceneBlockData;
    /** Counts for profiling, after every layout change. */
    onStats?: (stats: MistRollStats) => void;
    stacks: readonly Stack[] | undefined;
}) {
    const frame = useWeatherFrame();
    const camera = useThree((state) => state.camera);
    const time = useSceneTimeUniform();
    const requestRender = useSceneRenderRequest();

    const { material, uniforms } = useMemo(
        () => createMistRollMaterial(time),
        [time],
    );
    const mesh = useMemo(() => {
        const geometry = createMistRollGeometry();
        geometry.setAttribute(
            'aRoll',
            new InstancedBufferAttribute(new Float32Array(rollCapacity * 4), 4),
        );
        geometry.setAttribute(
            'aForm',
            new InstancedBufferAttribute(new Float32Array(rollCapacity), 1),
        );
        const instanced = new InstancedMesh(geometry, material, rollCapacity);
        instanced.name = 'Weather:MistRolls';
        instanced.count = 0;
        instanced.frustumCulled = false;
        instanced.renderOrder = 4;
        instanced.raycast = () => {};
        instanced.visible = false;
        return instanced;
    }, [material]);
    useEffect(
        () => () => {
            mesh.geometry.dispose();
            mesh.dispose();
            material.dispose();
        },
        [material, mesh],
    );

    // Storm and shower fog follows the island's cover curve, like the ground
    // mist; fog of its own keeps all of it.
    const amount = resolveMistRollAmount(resolveIslandFoggy(frame.amounts));
    const visible = amount > 0.01;
    const { caps, skyLayout, view } = frame;

    // Rim runs change only with the garden.
    const runs = useMemo(
        () =>
            visible
                ? resolveMistRimRuns(
                      resolveTerrainRimPlacements(blockData, stacks),
                  )
                : [],
        [blockData, stacks, visible],
    );

    // Which edges face the camera changes only when the view turns.
    camera.updateMatrixWorld();
    const forward = camera.matrixWorld.elements;
    const forwardX = -(forward[8] ?? 0);
    const forwardZ = -(forward[10] ?? 0);
    const turnKey = Math.round(Math.atan2(forwardZ, forwardX) * 20);
    // biome-ignore lint/correctness/useExhaustiveDependencies: the turn key stands for the camera heading.
    const rimRolls = useMemo(
        () =>
            resolveMistRimRolls({
                runs,
                cap: caps.mistRimRolls,
                forwardX,
                forwardZ,
            }),
        [caps.mistRimRolls, runs, turnKey],
    );

    // Placed by the weather frame, before the swooshes that avoid them.
    const skyPlacements = frame.skyProps.mistSkyRolls;
    const band = frame.skyProps.mistBand;

    const skyRolls = useMemo((): MistRoll[] => {
        if (!view || !skyLayout) return [];
        const placements = skyPlacements;
        const { right } = view.basis;
        const yaw = Math.atan2(-right.z, right.x);
        return placements.map((placement, index) => {
            const at = viewToWorld(
                view.basis,
                placement.u,
                placement.v,
                mistRollRules.skyAltitude,
                { x: 0, y: 0, z: 0 },
            );
            return {
                x: at.x,
                y: at.y,
                z: at.z,
                yaw,
                length: placement.width,
                height: mistRollRules.skyHeightScale,
                variant: placement.variant,
                opacity: mistRollRules.skyOpacity,
                slide: skyLayout.drift,
                bob: 0,
                phase: index * 2.11 + 0.4,
            };
        });
    }, [skyLayout, skyPlacements, view]);

    // Place the instances when the layout changes.
    useEffect(() => {
        const matrix = new Matrix4();
        const rotation = new Quaternion();
        const up = new Vector3(0, 1, 0);
        const position = new Vector3();
        const scale = new Vector3();
        const rolls = visible ? [...rimRolls, ...skyRolls] : [];
        const rollAttribute = mesh.geometry.getAttribute('aRoll');
        const formAttribute = mesh.geometry.getAttribute('aForm');
        let count = 0;
        for (const roll of rolls) {
            if (count >= rollCapacity) break;
            rotation.setFromAxisAngle(up, roll.yaw);
            position.set(roll.x, roll.y, roll.z);
            scale.set(roll.length, roll.length * roll.height, 1);
            matrix.compose(position, rotation, scale);
            mesh.setMatrixAt(count, matrix);
            rollAttribute.setXYZW(
                count,
                roll.opacity,
                roll.slide,
                roll.bob,
                roll.phase,
            );
            formAttribute.setX(count, roll.variant);
            count += 1;
        }
        mesh.count = count;
        mesh.instanceMatrix.needsUpdate = true;
        rollAttribute.needsUpdate = true;
        formAttribute.needsUpdate = true;
        mesh.visible = visible && count > 0;
        requestRender('weather-mist-rolls');
        if (!onStats) return;
        const ppu = view?.pixelsPerUnit ?? 0;
        const halfWidth = view?.halfWidth ?? 0;
        const halfHeight = view?.halfHeight ?? 0;
        const toPx = (u: number, v: number) => [
            Math.round((u + halfWidth) * ppu),
            Math.round((halfHeight - v) * ppu),
        ];
        onStats({
            rimRolls: visible ? rimRolls.length : 0,
            skyRolls: visible ? skyRolls.length : 0,
            rimRuns: runs.length,
            triangles: ((mesh.geometry.index?.count ?? 0) / 3) * count,
            bandReachPx: band ? Math.round((halfHeight - band[1]) * ppu) : null,
            skyRollBoxesPx: skyPlacements.map(({ rect }) => [
                ...toPx(rect[0], rect[3]),
                ...toPx(rect[2], rect[1]),
            ]),
        });
    }, [
        band,
        mesh,
        onStats,
        requestRender,
        rimRolls,
        runs.length,
        skyPlacements,
        skyRolls,
        view,
        visible,
    ]);

    // Colours and opacity follow the time of day and the fog blend.
    const { roles, reducedMotion } = frame;
    useEffect(() => {
        uniforms.uLit.value.copy(roles.mist);
        uniforms.uShade.value
            .copy(roles.mist)
            .lerp(roles.mistLow, mistRollMaterialRules.shadeMix);
        uniforms.uOpacity.value = amount;
        uniforms.uMotion.value = reducedMotion ? 0 : 1;
        mesh.visible = visible && mesh.count > 0;
        requestRender('weather-mist-rolls');
    }, [amount, mesh, reducedMotion, requestRender, roles, uniforms, visible]);

    return <primitive object={mesh} />;
}
