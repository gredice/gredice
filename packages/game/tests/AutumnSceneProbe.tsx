import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useRef } from 'react';
import {
    Color,
    InstancedMesh,
    Matrix4,
    Mesh,
    MeshStandardMaterial,
    Vector3,
} from 'three';
import { autumnPartLeafSurfaces } from '../src/entities/helpers/autumnLeafSurfaces';
import { bushTextureColor } from '../src/scene/bushFoliage';
import { readGameProfileMetadata } from '../src/scene/gameProfileMetadata';
import { useSceneTimeInvalidation } from '../src/scene/SceneTime';

function foliageColors(mesh: Mesh, material: MeshStandardMaterial) {
    const colors = mesh.geometry.getAttribute('color');
    const positions = mesh.geometry.getAttribute('position');
    if (!material.vertexColors || !colors) return material.color.getHexString();
    let bottom = 0;
    let top = 0;
    for (let index = 1; index < positions.count; index++) {
        if (positions.getY(index) < positions.getY(bottom)) bottom = index;
        if (positions.getY(index) > positions.getY(top)) top = index;
    }
    return [bottom, top]
        .map((index) =>
            new Color()
                .fromBufferAttribute(colors, index)
                .multiply(material.color)
                .multiply(
                    material.map && mesh.name.includes('Bush')
                        ? bushTextureColor
                        : new Color('white'),
                )
                .getHexString(),
        )
        .join('-');
}

export function AutumnSceneProbe({
    onReady,
    onSprigColors,
    onLeafCount,
    onLeafHeights,
    onGustCount,
    onGroundCount,
    onEntityCount,
    onPartCount,
    onPartMismatchFrames,
    onPartMotionSamples,
    onDropMotionSamples,
    onPartMismatchDetail,
    focus = [0, 0.8, 0],
}: {
    onReady: (value: string) => void;
    onSprigColors?: (value: string) => void;
    onEntityCount?: (count: number) => void;
    onPartCount?: (count: number) => void;
    onPartMismatchFrames?: (count: number) => void;
    onPartMotionSamples?: (count: number) => void;
    onDropMotionSamples?: (count: number) => void;
    onPartMismatchDetail?: (detail: string) => void;
    focus?: readonly [number, number, number];
    onGroundCount?: (count: number) => void;
    onLeafCount?: (count: number) => void;
    onLeafHeights?: (heights: string) => void;
    onGustCount?: (count: number) => void;
}) {
    const camera = useThree((state) => state.camera);
    const scene = useThree((state) => state.scene);
    const frames = useRef(0);
    const mismatchFrames = useRef(0);
    const motionSamples = useRef(0);
    const dropMotionSamples = useRef(0);
    const previousPartPosition = useRef<Vector3 | null>(null);
    useSceneTimeInvalidation('test:autumn-ready', frames.current < 5);
    useLayoutEffect(() => {
        camera.lookAt(focus[0], focus[1], focus[2]);
        camera.updateProjectionMatrix();
    }, [camera, focus[0], focus[1], focus[2]]);
    useFrame(() => {
        if (++frames.current < 5) return;
        const leaves = scene.getObjectByName('Weather:AutumnLeaves');
        if (leaves instanceof InstancedMesh) {
            onLeafCount?.(leaves.count);
            const matrix = new Matrix4();
            const heights = [];
            for (let index = 0; index < leaves.count; index++) {
                leaves.getMatrixAt(index, matrix);
                heights.push(new Vector3().setFromMatrixPosition(matrix).y);
            }
            onLeafHeights?.(heights.join(','));
        }
        onGustCount?.(readGameProfileMetadata()?.autumnGustCount ?? 0);
        const canopies: string[] = [];
        const sprigs: string[] = [];
        let groundCount = 0;
        let entityCount = 0;
        let partCount = 0;
        const leafPositions: Vector3[] = [];
        const expectedPositions: Vector3[] = [];
        scene.traverse((object) => {
            if (
                object.name.startsWith('BlockInstances:Autumn:entity:') &&
                object instanceof InstancedMesh
            )
                entityCount += object.count;
            if (
                object.name.startsWith('BlockInstances:Autumn:part:') &&
                object instanceof InstancedMesh
            ) {
                entityCount += object.count;
                partCount += object.count;
                object.updateWorldMatrix(true, false);
                for (let index = 0; index < object.count; index++) {
                    const matrix = new Matrix4();
                    object.getMatrixAt(index, matrix);
                    matrix.premultiply(object.matrixWorld);
                    leafPositions.push(
                        new Vector3().setFromMatrixPosition(matrix),
                    );
                }
            }
            const surfaces = autumnPartLeafSurfaces[object.name];
            if (surfaces) {
                object.updateWorldMatrix(true, false);
                for (const surface of surfaces)
                    expectedPositions.push(
                        object.localToWorld(
                            new Vector3(...surface.position).add(
                                new Vector3(0, 0.006, 0),
                            ),
                        ),
                    );
            }
            if (
                object.name.startsWith('BlockInstances:Autumn:ground:') &&
                object instanceof InstancedMesh
            )
                groundCount += object.count;
            if (
                (object.name.startsWith('Autumn:Canopy:') ||
                    object.name.startsWith('Autumn:BushCanopy:') ||
                    object.name.startsWith('BlockInstances:Bush:canopy:') ||
                    object.name.startsWith('BlockInstances:Tree:canopy:')) &&
                object instanceof Mesh &&
                object.material instanceof MeshStandardMaterial
            ) {
                for (
                    let index = 0;
                    index <
                    (object instanceof InstancedMesh ? object.count : 1);
                    index++
                )
                    canopies.push(
                        `${foliageColors(object, object.material)}:${object.geometry.index?.count ?? object.geometry.attributes.position.count}`,
                    );
            }
            if (
                (object.name.startsWith('Autumn:Sprigs:') ||
                    object.name.startsWith('Autumn:BushSprigs:') ||
                    object.name.startsWith('BlockInstances:Bush:sprigs:') ||
                    object.name.startsWith('BlockInstances:Tree:sprigs:')) &&
                object instanceof Mesh &&
                object.material instanceof MeshStandardMaterial
            ) {
                for (
                    let index = 0;
                    index <
                    (object instanceof InstancedMesh ? object.count : 1);
                    index++
                )
                    sprigs.push(foliageColors(object, object.material));
            }
        });
        onGroundCount?.(groundCount);
        onEntityCount?.(entityCount);
        onPartCount?.(partCount);
        const mismatch = leafPositions.find(
            (leaf) =>
                !expectedPositions.some(
                    (surface) => leaf.distanceTo(surface) < 0.002,
                ),
        );
        if (mismatch) {
            mismatchFrames.current++;
            const nearest = Math.min(
                ...expectedPositions.map((surface) =>
                    mismatch.distanceTo(surface),
                ),
            );
            onPartMismatchDetail?.(
                `${mismatch
                    .toArray()
                    .map((v) => v.toFixed(3))
                    .join(',')} nearest ${nearest.toFixed(3)}`,
            );
        }
        const first = leafPositions[0];
        if (
            first &&
            previousPartPosition.current &&
            first.distanceTo(previousPartPosition.current) > 0.0001
        )
            motionSamples.current++;
        previousPartPosition.current = first?.clone() ?? null;
        onPartMismatchFrames?.(mismatchFrames.current);
        onPartMotionSamples?.(motionSamples.current);
        const drop = scene.getObjectByName(
            'Animation:PlacementDropOffset:WoodenBench:part-surface:0',
        );
        if (drop && drop.position.y > 0.005) dropMotionSamples.current++;
        onDropMotionSamples?.(dropMotionSamples.current);
        if (canopies.length >= 3) onReady(canopies.join(','));
        onSprigColors?.(sprigs.join(','));
    });
    return null;
}
