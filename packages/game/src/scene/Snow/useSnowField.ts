'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { type IUniform, Vector2, Vector3 } from 'three';
import { useSceneTimeUniform } from '../SceneTime';
import type { WeatherFrame } from '../weather/WeatherFrameContext';
import { resolveSnowDrift, resolveWindVector } from '../weather/windClass';
import {
    advanceSnowFieldMotion,
    createSnowFieldMotion,
    resolveSnowFieldGeometry,
    type SnowFieldMotion,
    snowFieldStyle,
} from './snowParticles';

export type SnowFieldUniforms = {
    uTime: IUniform<number>;
    uMotionEpoch: IUniform<number>;
    uMotionBase: IUniform<number>;
    uMotionRate: IUniform<number>;
    uDriftBase: IUniform<Vector2>;
    uDriftVelocity: IUniform<Vector2>;
    uFieldBox: IUniform<Vector3>;
    uFieldScale: IUniform<number>;
    uFieldLift: IUniform<number>;
    uFallSpeed: IUniform<number>;
    uAxisRight: IUniform<Vector3>;
    uAxisDepth: IUniform<Vector3>;
    uUnitsPerPixel: IUniform<number>;
    uPerspective: IUniform<number>;
};

/**
 * Horizontal right and depth (away from the camera) axes from a camera's
 * right and forward directions.
 */
function writeHorizontalAxes(
    rightX: number,
    rightZ: number,
    forwardX: number,
    forwardZ: number,
    right: Vector3,
    depth: Vector3,
) {
    right.set(rightX, 0, rightZ);
    depth.set(forwardX, 0, forwardZ);
    if (right.lengthSq() < 1e-8) right.set(1, 0, 0);
    if (depth.lengthSq() < 1e-8) depth.set(0, 0, 1);
    right.normalize();
    depth.normalize();
}

/** Axes of a camera from its world matrix (it looks down its −z). */
function writeCameraAxes(
    elements: ArrayLike<number>,
    right: Vector3,
    depth: Vector3,
) {
    writeHorizontalAxes(
        elements[0] ?? 1,
        elements[2] ?? 0,
        -(elements[8] ?? 0),
        -(elements[10] ?? 1),
        right,
        depth,
    );
}

/**
 * Uniforms of the snow field shared by the disc and icon flakes: the motion
 * clock (rebased when the wind or reduced motion changes, so flakes never
 * jump), the field box sized to the view, and the camera's horizontal axes.
 * Nothing runs per frame in the orthographic view; the avatar views follow
 * their moving camera.
 */
export function useSnowField(frame: WeatherFrame) {
    const timeUniform = useSceneTimeUniform();
    const camera = useThree((state) => state.camera);
    const motionRef = useRef<SnowFieldMotion | null>(null);

    const uniforms = useMemo<SnowFieldUniforms>(
        () => ({
            uTime: timeUniform,
            uMotionEpoch: { value: timeUniform.value },
            uMotionBase: { value: 0 },
            uMotionRate: { value: 1 },
            uDriftBase: { value: new Vector2() },
            uDriftVelocity: { value: new Vector2() },
            uFieldBox: { value: new Vector3(14, 10, 10) },
            uFieldScale: { value: 1 },
            uFieldLift: { value: snowFieldStyle.fieldLift },
            uFallSpeed: { value: snowFieldStyle.fallSpeed },
            uAxisRight: { value: new Vector3(1, 0, 0) },
            uAxisDepth: { value: new Vector3(0, 0, 1) },
            uUnitsPerPixel: { value: 0.01 },
            uPerspective: { value: 0 },
        }),
        [timeUniform],
    );

    const rate = frame.reducedMotion ? snowFieldStyle.reducedMotionRate : 1;
    const drift = resolveSnowDrift(frame.amounts.windClass);
    const wind = resolveWindVector(frame.amounts.windDirection);
    const velocityX = drift * wind.x;
    const velocityZ = drift * wind.z;

    useLayoutEffect(() => {
        const now = timeUniform.value;
        const motion = advanceSnowFieldMotion(
            motionRef.current ?? createSnowFieldMotion(now),
            now,
            { rate, velocityX, velocityZ },
        );
        motionRef.current = motion;
        uniforms.uMotionEpoch.value = motion.epoch;
        uniforms.uMotionBase.value = motion.base;
        uniforms.uMotionRate.value = motion.rate;
        uniforms.uDriftBase.value.set(motion.driftX, motion.driftZ);
        uniforms.uDriftVelocity.value.set(motion.velocityX, motion.velocityZ);
    }, [rate, timeUniform, uniforms, velocityX, velocityZ]);

    const { view } = frame;
    const geometry = useMemo(() => resolveSnowFieldGeometry(view), [view]);

    useLayoutEffect(() => {
        uniforms.uFieldBox.value.set(...geometry.box);
        uniforms.uFieldScale.value = geometry.scale;
        uniforms.uUnitsPerPixel.value = geometry.unitsPerPixel;
        uniforms.uPerspective.value = geometry.perspective ? 1 : 0;
        if (view) {
            const { forward, right } = view.basis;
            writeHorizontalAxes(
                right.x,
                right.z,
                forward.x,
                forward.z,
                uniforms.uAxisRight.value,
                uniforms.uAxisDepth.value,
            );
        } else {
            camera.updateMatrixWorld();
            writeCameraAxes(
                camera.matrixWorld.elements,
                uniforms.uAxisRight.value,
                uniforms.uAxisDepth.value,
            );
        }
    }, [camera, geometry, uniforms, view]);

    // The avatar camera moves without a new orthographic view, so its axes
    // follow it on each rendered frame (snowfall already renders each frame).
    const avatar = geometry.perspective;
    useFrame(({ camera: activeCamera }) => {
        if (!avatar) {
            return;
        }
        writeCameraAxes(
            activeCamera.matrixWorld.elements,
            uniforms.uAxisRight.value,
            uniforms.uAxisDepth.value,
        );
    }, -90);

    return uniforms;
}
