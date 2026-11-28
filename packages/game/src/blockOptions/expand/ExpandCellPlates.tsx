'use client';

import { Line } from '@react-three/drei';
import { useLayoutEffect, useRef } from 'react';
import { type InstancedMesh, Matrix4 } from 'three';
import { useSceneRenderRequest } from '../../scene/SceneTime';
import type { ExpandCell } from './expandPointer';

const renderReason = 'block-expand-preview';
const plateColor = '#4ade80';
const plateOpacity = 0.35;
const plateSize = 0.9;
/** Just above the surface, so plates never fight it for depth. */
const plateLift = 0.02;
const outlineColor = '#86efac';
const outlineLift = 0.03;
const outlineWidth = 2;
const noRaycast = () => null;

// Plates lie flat: the plane geometry faces +z, so each instance is turned
// −90° about x before it is moved onto its cell.
const flat = new Matrix4().makeRotationX(-Math.PI / 2);
const translation = new Matrix4();
const instance = new Matrix4();

export type ExpandBounds = {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
};

/**
 * Green plates under the cells that get a copy (spec §7.5): one instanced
 * mesh for the whole rectangle. Skipped cells get none; the outline shows
 * the rectangle's extent around them.
 */
function ExpandPlates({
    baseHeight,
    capacity,
    cells,
}: {
    baseHeight: number;
    capacity: number;
    cells: readonly ExpandCell[];
}) {
    const meshRef = useRef<InstancedMesh>(null);
    const requestRender = useSceneRenderRequest();
    const maxInstances = Math.max(1, capacity);

    useLayoutEffect(() => {
        const mesh = meshRef.current;
        if (!mesh) {
            return;
        }

        let count = 0;
        for (const cell of cells) {
            if (count >= maxInstances) {
                break;
            }
            translation.makeTranslation(cell.x, baseHeight + plateLift, cell.z);
            instance.multiplyMatrices(translation, flat);
            mesh.setMatrixAt(count, instance);
            count++;
        }
        mesh.count = count;
        mesh.instanceMatrix.needsUpdate = true;
        requestRender(renderReason);
    }, [baseHeight, cells, maxInstances, requestRender]);

    return (
        <instancedMesh
            ref={meshRef}
            args={[undefined, undefined, maxInstances]}
            castShadow={false}
            receiveShadow={false}
            frustumCulled={false}
            name="BlockExpand:Plates"
            raycast={noRaycast}
            renderOrder={1}
        >
            <planeGeometry args={[plateSize, plateSize]} />
            <meshBasicMaterial
                color={plateColor}
                transparent
                opacity={plateOpacity}
                depthWrite={false}
            />
        </instancedMesh>
    );
}

/**
 * The outline's points: a unit square on the ground plane. They never
 * change, so drei's `Line` keeps one geometry and one material; a new
 * points array would make it build a new geometry and dispose its
 * material, and three would compile and link the line shader again on
 * every corner change.
 */
const unitOutlinePoints: [number, number, number][] = [
    [0, 0, 0],
    [1, 0, 0],
    [1, 0, 1],
    [0, 0, 1],
    [0, 0, 0],
];

/**
 * One line around the whole rectangle, drawn over everything. A parent
 * group places and scales the unit square onto the rectangle; the line's
 * width is in screen pixels, so scaling does not thicken it.
 */
function ExpandOutline({
    baseHeight,
    bounds,
}: {
    baseHeight: number;
    bounds: ExpandBounds;
}) {
    const requestRender = useSceneRenderRequest();
    const left = bounds.minX - 0.5;
    const back = bounds.minZ - 0.5;
    const width = bounds.maxX - bounds.minX + 1;
    const depth = bounds.maxZ - bounds.minZ + 1;
    const y = baseHeight + outlineLift;

    // biome-ignore lint/correctness/useExhaustiveDependencies: the rectangle is the redraw key; the group takes it through props.
    useLayoutEffect(() => {
        requestRender(renderReason);
    }, [back, depth, left, requestRender, width, y]);

    return (
        <group position={[left, y, back]} scale={[width, 1, depth]}>
            <Line
                name="BlockExpand:Outline"
                points={unitOutlinePoints}
                color={outlineColor}
                lineWidth={outlineWidth}
                depthTest={false}
                depthWrite={false}
                transparent
                renderOrder={2}
                raycast={noRaycast}
            />
        </group>
    );
}

/** The cell plates and the rectangle outline of the Expand preview. */
export function ExpandCellPlates({
    baseHeight,
    bounds,
    capacity,
    cells,
}: {
    /** The surface the copies stand on. */
    baseHeight: number;
    bounds: ExpandBounds;
    /** The most copies the rectangle can hold (`maxSide²`). */
    capacity: number;
    /** Cells that get a copy. */
    cells: readonly ExpandCell[];
}) {
    return (
        <group name="BlockExpand:Cells">
            <ExpandPlates
                baseHeight={baseHeight}
                capacity={capacity}
                cells={cells}
            />
            <ExpandOutline baseHeight={baseHeight} bounds={bounds} />
        </group>
    );
}
