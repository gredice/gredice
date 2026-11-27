'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
    Color,
    InstancedMesh,
    Matrix4,
    Quaternion,
    Shape,
    ShapeGeometry,
    Vector3,
} from 'three';
import { useSeasonState } from '../../../hooks/useSeasonState';
import { createAutumnLeafMaterial } from '../../autumnLeafMaterial';
import { updateGameProfileMetadata } from '../../gameProfileMetadata';
import {
    useSceneFixedTimeSeconds,
    useSceneRenderRequest,
    useSceneTimeInvalidation,
    useSceneTimeUniform,
} from '../../SceneTime';
import { viewToWorld } from '../skyLayout';
import type { WeatherFrame } from '../WeatherFrameContext';
import { resolveWindLeafCount, resolveWindVector } from '../windClass';
import { windLeafPalettes } from './windLeafPalette';
import { resolveSwooshFlip, swooshHash } from './windSwooshLayout';

/** Leaf motion, from the target page's wind leaves. */
export const windLeafMotion = {
    /** Sideways speed in world units per second: 0.4 + 0.5 × class. */
    baseSpeed: 0.4,
    speedPerClass: 0.5,
    /** Heights above the ground, and the bob. */
    minHeight: 0.4,
    heightRange: 1.6,
    bob: 0.22,
    /** Spread in depth around the view's centre line, in world units. */
    depthRange: 4,
    /** Tumble speed in radians per second. */
    minSpin: 2,
    spinRange: 3,
    /** Leaves wrap this far past the view's side edges. */
    edge: 1,
} as const;

/** A pointed oval leaf about 0.21 units (20 px at zoom 100) long. */
function createWindLeafGeometry() {
    const shape = new Shape();
    shape.moveTo(0, -0.1);
    shape.quadraticCurveTo(0.084, -0.02, 0, 0.11);
    shape.quadraticCurveTo(-0.084, -0.02, 0, -0.1);
    const geometry = new ShapeGeometry(shape, 6);
    geometry.deleteAttribute('uv');
    geometry.name = 'Weather:WindLeafGeometry';
    return geometry;
}

type LeafSeed = {
    along: number;
    depth: number;
    height: number;
    phase: number;
    spin: number;
    axis: Vector3;
};

function createLeafSeeds(capacity: number): LeafSeed[] {
    return Array.from({ length: capacity }, (_, index) => {
        const r = (k: number) => swooshHash(index * 31.7 + k * 7.3 + 503);
        return {
            along: r(1),
            depth: (r(2) - 0.5) * windLeafMotion.depthRange,
            height:
                windLeafMotion.minHeight + r(3) * windLeafMotion.heightRange,
            phase: r(4) * Math.PI * 2,
            spin: windLeafMotion.minSpin + r(5) * windLeafMotion.spinRange,
            axis: new Vector3(r(6) - 0.5, r(7) - 0.5, r(8) - 0.5).normalize(),
        };
    });
}

/**
 * A few leaves tumbling across the view in a breeze (GAME_ART.md "Weather >
 * Wind > Leaves"): (class − 0.8) × 3.2, at most 14 / 10 / 0 by tier, in the
 * season's canopy colours. None in snow, in winter or under reduced motion.
 * One instanced draw, lit like a canopy top.
 */
export function WindLeaves({ frame }: { frame: WeatherFrame }) {
    const { season } = useSeasonState();
    const palette = windLeafPalettes[season];
    const capacity = frame.caps.windLeaves;
    const count =
        palette.length === 0 || frame.view === null
            ? 0
            : resolveWindLeafCount(frame.amounts.windClass, {
                  cap: capacity,
                  reducedMotion: frame.reducedMotion,
                  snowy: frame.amounts.snowy,
              });

    const fixedTimeSeconds = useSceneFixedTimeSeconds();
    const time = useSceneTimeUniform();
    const requestRender = useSceneRenderRequest();
    useSceneTimeInvalidation(
        'weather-wind-leaves',
        count > 0 && fixedTimeSeconds === undefined,
    );
    useEffect(() => {
        updateGameProfileMetadata({ windLeafCount: count });
    }, [count]);
    useEffect(() => () => updateGameProfileMetadata({ windLeafCount: 0 }), []);

    const mesh = useMemo(() => {
        const value = new InstancedMesh(
            createWindLeafGeometry(),
            createAutumnLeafMaterial({ color: 'white' }),
            Math.max(1, capacity),
        );
        value.name = 'Weather:WindLeaves';
        value.count = 0;
        value.frustumCulled = false;
        value.raycast = () => {};
        return value;
    }, [capacity]);
    useEffect(
        () => () => {
            mesh.geometry.dispose();
            mesh.material.dispose();
            mesh.dispose();
        },
        [mesh],
    );
    const seeds = useMemo(() => createLeafSeeds(capacity), [capacity]);

    useEffect(() => {
        const color = new Color();
        for (let index = 0; index < capacity; index += 1) {
            const hex = palette[index % Math.max(1, palette.length)];
            if (hex) mesh.setColorAt(index, color.set(hex));
        }
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        requestRender('weather-wind-leaves-change');
    }, [capacity, mesh, palette, requestRender]);

    const frameRef = useRef(frame);
    frameRef.current = frame;
    const scratch = useMemo(
        () => ({
            position: new Vector3(),
            rotation: new Quaternion(),
            scale: new Vector3(1, 1, 1),
            matrix: new Matrix4(),
            depthAxis: new Vector3(),
        }),
        [],
    );

    useFrame(() => {
        const current = frameRef.current;
        const view = current.view;
        if (count === 0 || !view) {
            mesh.count = 0;
            mesh.visible = false;
            return;
        }
        const { basis, halfWidth } = view;
        const flip = resolveSwooshFlip(
            resolveWindVector(current.amounts.windDirection),
            basis.right,
        );
        const speed =
            windLeafMotion.baseSpeed +
            windLeafMotion.speedPerClass * current.amounts.windClass;
        const span = 2 * halfWidth + 2 * windLeafMotion.edge;
        const t = time.value;
        // Depth runs along the ground, away from the camera.
        scratch.depthAxis.set(basis.forward.x, 0, basis.forward.z).normalize();
        for (let index = 0; index < count; index += 1) {
            const seed = seeds[index];
            if (!seed) continue;
            const travel =
                (((seed.along * span + t * speed) % span) + span) % span;
            const u = flip * (travel - halfWidth - windLeafMotion.edge);
            viewToWorld(basis, u, 0, 0, scratch.position);
            scratch.position.addScaledVector(scratch.depthAxis, seed.depth);
            scratch.position.y =
                seed.height +
                windLeafMotion.bob * Math.sin(t * 1.7 + seed.phase);
            scratch.rotation.setFromAxisAngle(
                seed.axis,
                t * seed.spin + seed.phase,
            );
            scratch.matrix.compose(
                scratch.position,
                scratch.rotation,
                scratch.scale,
            );
            mesh.setMatrixAt(index, scratch.matrix);
        }
        mesh.count = count;
        mesh.visible = true;
        mesh.instanceMatrix.needsUpdate = true;
    });

    return <primitive object={mesh} dispose={null} />;
}
