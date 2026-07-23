import {
    cloneElement,
    isValidElement,
    type ReactNode,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
} from 'react';
import type { InstancedMesh, Material } from 'three';
import type { BufferGeometry } from 'three/src/Three.Core.js';
import {
    type ActiveDragPreviewTarget,
    activeDragPreviewTargetMatches,
    createActiveDragPreviewTarget,
    getActiveDragPreviewTargetPositionOffset,
} from '../dragPreviewIdentity';
import { useBlockData } from '../hooks/useBlockData';
import {
    RainWetOverlay,
    useRainWetOverlayMaterial,
    useRainWetOverlayVisible,
} from '../rain/RainWetOverlay';
import { createSnowOverlayGeometry } from '../snow/createSnowOverlayGeometry';
import {
    type SnowMaterialOptions,
    SnowOverlay,
    useSnowMaterial,
    useSnowOverlayVisible,
} from '../snow/SnowOverlay';
import type { Block } from '../types/Block';
import type { Stack } from '../types/Stack';
import { type ActiveDragPreview, useGameState } from '../useGameState';
import { getStackHeight } from '../utils/getStackHeight';
import {
    chunkMeshInstances,
    createMergedChunkGeometry,
    createMeshInstanceMatrix,
    type MeshInstanceChunk,
    type MeshInstanceLocalTransform,
} from './chunkedMeshGeometry';
import {
    getIndexedEntityBlocks,
    useEntityBlockInstanceIndex,
} from './entityBlockInstanceIndex';
import { blockPickupOutlineStyle } from './helpers/blockPickupOutlineStyle';
import { HoverOutline } from './helpers/HoverOutline';
import { PlacementDropAnimation } from './helpers/PlacementDropAnimation';

const defaultLocalPosition: [number, number, number] = [0, 0, 0];
const defaultLocalRotation: [number, number, number] = [0, 0, 0];

export type EntityInstancesBlockBaseProps = {
    stacks: Stack[] | undefined;
    name: string;
    renderSnow?: boolean;
    localPosition?: [number, number, number];
    localRotation?: [number, number, number];
    yOffset?: number;
    snowLift?: number;
    snowOverlayMinCoverage?: number;
    scale?: number | [number, number, number];
    geometry: BufferGeometry;
    snow?: SnowMaterialOptions;
    renderRainWetOverlay?: boolean;
    renderStableChunksAsMergedGeometry?: boolean;
    castShadow?: boolean;
    receiveShadow?: boolean;
    renderOrder?: number;
};

export type EntityInstancesBlockMaterialProps =
    | {
          material: Material | Material[];
          materialNode?: never;
      }
    | {
          material?: never;
          materialNode: ReactNode;
      };

export type EntityBlockInstance = {
    block: Block;
    blockIndex: number;
    id: string;
    pickupOutlineVisible: boolean;
    position: [number, number, number];
    rotation: number;
    stack: Stack;
    stackHeight: number;
};

function numbersEqual(left: number, right: number) {
    return Math.abs(left - right) <= 0.0001;
}

function tuplesEqual(
    left: [number, number, number],
    right: [number, number, number],
) {
    return (
        numbersEqual(left[0], right[0]) &&
        numbersEqual(left[1], right[1]) &&
        numbersEqual(left[2], right[2])
    );
}

function scalesEqual(
    left: EntityInstancesBlockBaseProps['scale'],
    right: EntityInstancesBlockBaseProps['scale'],
) {
    if (left === right) {
        return true;
    }
    if (Array.isArray(left) && Array.isArray(right)) {
        return tuplesEqual(left, right);
    }
    return false;
}

function entityBlockInstancesEqual(
    left: EntityBlockInstance[] | undefined,
    right: EntityBlockInstance[] | undefined,
) {
    if (left === right) {
        return true;
    }
    if (!left || !right || left.length !== right.length) {
        return false;
    }

    return left.every((leftInstance, index) => {
        const rightInstance = right[index];
        return (
            Boolean(rightInstance) &&
            leftInstance.block === rightInstance.block &&
            leftInstance.blockIndex === rightInstance.blockIndex &&
            leftInstance.id === rightInstance.id &&
            leftInstance.pickupOutlineVisible ===
                rightInstance.pickupOutlineVisible &&
            tuplesEqual(leftInstance.position, rightInstance.position) &&
            numbersEqual(leftInstance.rotation, rightInstance.rotation) &&
            leftInstance.stack === rightInstance.stack &&
            numbersEqual(leftInstance.stackHeight, rightInstance.stackHeight)
        );
    });
}

function useStableEntityBlockInstances(
    instances: EntityBlockInstance[] | undefined,
) {
    const previous = useRef<EntityBlockInstance[] | undefined>(undefined);

    if (!entityBlockInstancesEqual(previous.current, instances)) {
        previous.current = instances;
    }

    return previous.current;
}

function useStableTuple(tuple: [number, number, number]) {
    const previous = useRef(tuple);

    if (!tuplesEqual(previous.current, tuple)) {
        previous.current = tuple;
    }

    return previous.current;
}

function useStableScale(scale: EntityInstancesBlockBaseProps['scale']) {
    const previous = useRef(scale);

    if (!scalesEqual(previous.current, scale)) {
        previous.current = scale;
    }

    return previous.current;
}

function cloneMaterialNode(materialNode: ReactNode) {
    return isValidElement(materialNode)
        ? cloneElement(materialNode)
        : materialNode;
}

function blockNameMatches(
    blockName: string,
    name: string | undefined,
    names: readonly string[] | undefined,
) {
    return blockName === name || (names?.includes(blockName) ?? false);
}

function activeDragTargetKey(target: ActiveDragPreviewTarget) {
    return `${target.stackPosition.x}|${target.stackPosition.z}|${target.blockId}|${target.blockIndex}`;
}

function activeDragTargetTouchesBlockNames(
    target: ActiveDragPreviewTarget | null | undefined,
    blockNameByActiveDragTargetKey: ReadonlyMap<string, string>,
    name: string | undefined,
    names: readonly string[] | undefined,
) {
    if (!target) {
        return false;
    }

    const blockName = blockNameByActiveDragTargetKey.get(
        activeDragTargetKey(target),
    );

    return blockName ? blockNameMatches(blockName, name, names) : false;
}

function activeDragPreviewTouchesBlockNames(
    preview: ActiveDragPreview | null,
    blockNameByActiveDragTargetKey: ReadonlyMap<string, string>,
    name: string | undefined,
    names: readonly string[] | undefined,
) {
    if (!preview) {
        return false;
    }

    return (
        activeDragTargetTouchesBlockNames(
            preview.source,
            blockNameByActiveDragTargetKey,
            name,
            names,
        ) ||
        preview.targets.some((target) =>
            activeDragTargetTouchesBlockNames(
                target,
                blockNameByActiveDragTargetKey,
                name,
                names,
            ),
        )
    );
}

export function useEntityBlockInstances({
    name,
    names,
    stacks,
    yOffset,
}: {
    name?: string;
    names?: readonly string[];
    stacks: Stack[] | undefined;
    yOffset?: number;
}) {
    const { data: blockData } = useBlockData();
    const entityBlockInstanceIndex = useEntityBlockInstanceIndex(stacks);
    const { blockNameByActiveDragTargetKey } = entityBlockInstanceIndex;
    const activeDragPreview = useGameState((state) =>
        activeDragPreviewTouchesBlockNames(
            state.activeDragPreview,
            blockNameByActiveDragTargetKey,
            name,
            names,
        )
            ? state.activeDragPreview
            : null,
    );
    const stationaryPickupOutlineTarget = useGameState((state) =>
        activeDragTargetTouchesBlockNames(
            state.stationaryPickupOutlineTarget,
            blockNameByActiveDragTargetKey,
            name,
            names,
        )
            ? state.stationaryPickupOutlineTarget
            : null,
    );

    const indexedBlocks = getIndexedEntityBlocks(
        entityBlockInstanceIndex,
        name,
        names,
    );
    const instances = stacks
        ? indexedBlocks.map(
              ({ block, blockIndex, stack }): EntityBlockInstance => {
                  const stackHeight = getStackHeight(blockData, stack, block);
                  const target = createActiveDragPreviewTarget({
                      blockId: block.id,
                      blockIndex,
                      stackPosition: stack.position,
                  });
                  const dragPreviewOffset =
                      getActiveDragPreviewTargetPositionOffset(
                          target,
                          activeDragPreview,
                      );
                  const stationaryPickupOutlineVisible =
                      activeDragPreviewTargetMatches(
                          stationaryPickupOutlineTarget,
                          target,
                      );

                  return {
                      block,
                      blockIndex,
                      id: `${stack.position.x}|${stack.position.z}|${block.id}|${blockIndex}`,
                      pickupOutlineVisible:
                          Boolean(dragPreviewOffset) ||
                          stationaryPickupOutlineVisible,
                      position: [
                          stack.position.x + (dragPreviewOffset?.x ?? 0),
                          stackHeight +
                              (yOffset ?? 0) +
                              (dragPreviewOffset?.y ?? 0),
                          stack.position.z + (dragPreviewOffset?.z ?? 0),
                      ],
                      rotation: block.rotation || 0,
                      stack,
                      stackHeight,
                  };
              },
          )
        : undefined;

    return useStableEntityBlockInstances(instances);
}

export function EntityInstancesBlock(
    props: EntityInstancesBlockBaseProps & EntityInstancesBlockMaterialProps,
) {
    const {
        stacks,
        name,
        renderSnow = true,
        localPosition,
        localRotation,
        yOffset,
        snowLift = 0,
        snowOverlayMinCoverage,
        scale,
        geometry,
        snow,
        renderRainWetOverlay = false,
        renderStableChunksAsMergedGeometry,
        castShadow = true,
        receiveShadow = true,
        renderOrder,
    } = props;
    const blockInstances = useEntityBlockInstances({
        name,
        stacks,
        yOffset,
    });

    const commonProps = {
        castShadow,
        geometry,
        instanceKey: name,
        instances: blockInstances,
        localPosition,
        localRotation,
        receiveShadow,
        renderOrder,
        renderRainWetOverlay,
        renderStableChunksAsMergedGeometry,
        renderSnow,
        scale,
        snow,
        snowLift,
        snowOverlayMinCoverage,
    };

    if (props.material) {
        return (
            <EntityInstancesGeometry
                {...commonProps}
                material={props.material}
            />
        );
    }

    return (
        <EntityInstancesGeometry
            {...commonProps}
            materialNode={props.materialNode}
        />
    );
}

export function EntityInstancesGeometry(
    props: Omit<EntityInstancesBlockBaseProps, 'name' | 'stacks' | 'yOffset'> &
        EntityInstancesBlockMaterialProps & {
            instanceKey: string;
            instances: EntityBlockInstance[] | undefined;
        },
) {
    const {
        instanceKey,
        instances,
        renderSnow = true,
        localPosition,
        localRotation,
        scale,
        geometry,
        snow,
        snowLift = 0,
        snowOverlayMinCoverage,
        renderRainWetOverlay = false,
        renderStableChunksAsMergedGeometry = false,
        castShadow = true,
        receiveShadow = true,
        renderOrder,
    } = props;
    const placementDropAnimations = useGameState(
        (state) => state.blockPlacementDropAnimations,
    );

    const stableLocalPosition = useStableTuple(
        localPosition ?? defaultLocalPosition,
    );
    const stableLocalRotation = useStableTuple(
        localRotation ?? defaultLocalRotation,
    );
    const stableScale = useStableScale(scale);
    const localTransform = useMemo(
        () => ({
            position: stableLocalPosition,
            rotation: stableLocalRotation,
        }),
        [stableLocalPosition, stableLocalRotation],
    );
    const animatedBlockIds = useMemo(
        () => new Set(Object.keys(placementDropAnimations)),
        [placementDropAnimations],
    );
    const stableInstances = useMemo(
        () =>
            (instances ?? []).filter(
                (data) => !animatedBlockIds.has(data.block.id),
            ),
        [animatedBlockIds, instances],
    );
    const animatedInstances = useMemo(
        () =>
            (instances ?? []).filter((data) =>
                animatedBlockIds.has(data.block.id),
            ),
        [animatedBlockIds, instances],
    );
    const stableChunks = useMemo(
        () => chunkMeshInstances(stableInstances),
        [stableInstances],
    );

    const material = 'material' in props ? props.material : undefined;
    const materialNode = 'materialNode' in props ? props.materialNode : null;

    if (!instances?.length) {
        return null;
    }

    const renderAnimatedInstances = (suffix: string) =>
        animatedInstances.map((data) => (
            <PlacementDropAnimation
                key={`block-${instanceKey}-${suffix}-${data.id}`}
                animation={placementDropAnimations[data.block.id]}
                block={data.block}
                particlePosition={[
                    data.position[0],
                    data.stackHeight,
                    data.position[2],
                ]}
                position={data.position}
            >
                <group rotation={[0, data.rotation * (Math.PI / 2), 0]}>
                    <mesh
                        geometry={geometry}
                        material={material}
                        position={localTransform.position}
                        rotation={localTransform.rotation}
                        scale={stableScale}
                        receiveShadow={receiveShadow}
                        castShadow={castShadow}
                        renderOrder={renderOrder}
                    >
                        {cloneMaterialNode(materialNode)}
                    </mesh>
                </group>
            </PlacementDropAnimation>
        ));

    const renderAnimatedSnowOverlays = () =>
        !snow || !renderSnow
            ? null
            : animatedInstances.map((data) => (
                  <PlacementDropAnimation
                      key={`block-${instanceKey}-snow-${data.id}`}
                      animation={placementDropAnimations[data.block.id]}
                      block={data.block}
                      particlePosition={[
                          data.position[0],
                          data.stackHeight,
                          data.position[2],
                      ]}
                      position={[
                          data.position[0],
                          data.position[1] + (snowLift || 0.003),
                          data.position[2],
                      ]}
                  >
                      <group rotation={[0, data.rotation * (Math.PI / 2), 0]}>
                          <group
                              position={localTransform.position}
                              rotation={localTransform.rotation}
                              scale={stableScale}
                          >
                              <SnowOverlay
                                  geometry={geometry}
                                  minCoverage={snowOverlayMinCoverage}
                                  {...snow}
                              />
                          </group>
                      </group>
                  </PlacementDropAnimation>
              ));

    const renderAnimatedRainOverlays = () =>
        !renderRainWetOverlay
            ? null
            : animatedInstances.map((data) => (
                  <PlacementDropAnimation
                      key={`block-${instanceKey}-rain-${data.id}`}
                      animation={placementDropAnimations[data.block.id]}
                      block={data.block}
                      particlePosition={[
                          data.position[0],
                          data.stackHeight,
                          data.position[2],
                      ]}
                      position={data.position}
                  >
                      <group rotation={[0, data.rotation * (Math.PI / 2), 0]}>
                          <group
                              position={localTransform.position}
                              rotation={localTransform.rotation}
                              scale={stableScale}
                          >
                              <RainWetOverlay geometry={geometry} />
                          </group>
                      </group>
                  </PlacementDropAnimation>
              ));

    return (
        <>
            {stableChunks.map((chunk) =>
                renderStableChunksAsMergedGeometry ? (
                    <ChunkedMergedMesh
                        key={`${instanceKey}:${chunk.key}`}
                        castShadow={castShadow}
                        chunk={chunk}
                        debugName={`MergedBlockChunk:${instanceKey}:chunk:${chunk.key}:count:${chunk.instances.length}`}
                        geometry={geometry}
                        localTransform={localTransform}
                        material={material}
                        materialNode={materialNode}
                        receiveShadow={receiveShadow}
                        renderOrder={renderOrder}
                        scale={stableScale}
                    />
                ) : (
                    <ChunkedInstancedMesh
                        key={`${instanceKey}:${chunk.key}`}
                        castShadow={castShadow}
                        chunk={chunk}
                        debugName={`BlockInstances:${instanceKey}:chunk:${chunk.key}:count:${chunk.instances.length}`}
                        geometry={geometry}
                        localTransform={localTransform}
                        material={material}
                        materialNode={materialNode}
                        receiveShadow={receiveShadow}
                        renderOrder={renderOrder}
                        scale={stableScale}
                    />
                ),
            )}
            {renderAnimatedInstances('base')}
            {(instances ?? []).map((data) =>
                data.pickupOutlineVisible ? (
                    <HoverOutline
                        key={`block-${instanceKey}-pickup-outline-${data.id}`}
                        {...blockPickupOutlineStyle}
                        hovered
                    >
                        <group
                            position={data.position}
                            rotation={[0, data.rotation * (Math.PI / 2), 0]}
                        >
                            <mesh
                                geometry={geometry}
                                position={localTransform.position}
                                rotation={localTransform.rotation}
                                scale={stableScale}
                                raycast={() => null}
                            >
                                <meshBasicMaterial visible={false} />
                            </mesh>
                        </group>
                    </HoverOutline>
                ) : null,
            )}
            {renderRainWetOverlay && (
                <InstancedRainWetOverlays
                    chunks={stableChunks}
                    geometry={geometry}
                    localTransform={localTransform}
                    scale={stableScale}
                />
            )}
            {snow && renderSnow && (
                <InstancedSnowOverlays
                    chunks={stableChunks}
                    geometry={geometry}
                    localTransform={localTransform}
                    scale={stableScale}
                    snow={snow}
                    snowLift={snowLift}
                    snowOverlayMinCoverage={snowOverlayMinCoverage}
                />
            )}
            {renderAnimatedRainOverlays()}
            {renderAnimatedSnowOverlays()}
        </>
    );
}

function ChunkedInstancedMesh({
    castShadow,
    chunk,
    debugName,
    geometry,
    localTransform,
    material,
    materialNode,
    receiveShadow,
    renderOrder,
    scale,
}: {
    castShadow: boolean;
    chunk: MeshInstanceChunk<EntityBlockInstance>;
    debugName: string;
    geometry: BufferGeometry;
    localTransform: MeshInstanceLocalTransform;
    material: Material | Material[] | undefined;
    materialNode: ReactNode;
    receiveShadow: boolean;
    renderOrder?: number;
    scale: EntityInstancesBlockBaseProps['scale'];
}) {
    const meshRef = useRef<InstancedMesh | null>(null);

    useLayoutEffect(() => {
        const mesh = meshRef.current;
        if (!mesh) {
            return;
        }

        chunk.instances.forEach((instance, index) => {
            mesh.setMatrixAt(
                index,
                createMeshInstanceMatrix(instance, localTransform, scale),
            );
        });
        mesh.count = chunk.instances.length;
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingBox();
        mesh.computeBoundingSphere();
    }, [chunk.instances, localTransform, scale]);

    return (
        <instancedMesh
            ref={meshRef}
            name={debugName}
            args={[geometry, material, chunk.instances.length]}
            castShadow={castShadow}
            receiveShadow={receiveShadow}
            renderOrder={renderOrder}
        >
            {cloneMaterialNode(materialNode)}
        </instancedMesh>
    );
}

function ChunkedMergedMesh({
    castShadow,
    chunk,
    debugName,
    geometry,
    localTransform,
    material,
    materialNode,
    receiveShadow,
    renderOrder,
    scale,
}: {
    castShadow: boolean;
    chunk: MeshInstanceChunk<EntityBlockInstance>;
    debugName: string;
    geometry: BufferGeometry;
    localTransform: MeshInstanceLocalTransform;
    material: Material | Material[] | undefined;
    materialNode: ReactNode;
    receiveShadow: boolean;
    renderOrder?: number;
    scale: EntityInstancesBlockBaseProps['scale'];
}) {
    const mergedGeometry = useMemo(
        () =>
            createMergedChunkGeometry({
                geometry,
                instances: chunk.instances,
                localTransform,
                scale,
            }),
        [chunk.instances, geometry, localTransform, scale],
    );

    useEffect(() => () => mergedGeometry.dispose(), [mergedGeometry]);

    if (!mergedGeometry.getAttribute('position')) {
        return null;
    }

    return (
        <mesh
            name={debugName}
            castShadow={castShadow}
            receiveShadow={receiveShadow}
            renderOrder={renderOrder}
            geometry={mergedGeometry}
            material={material}
        >
            {cloneMaterialNode(materialNode)}
        </mesh>
    );
}

function InstancedSnowOverlays({
    chunks,
    geometry,
    localTransform,
    scale,
    snow,
    snowLift,
    snowOverlayMinCoverage,
}: {
    chunks: MeshInstanceChunk<EntityBlockInstance>[];
    geometry: BufferGeometry;
    localTransform: MeshInstanceLocalTransform;
    scale: EntityInstancesBlockBaseProps['scale'];
    snow: SnowMaterialOptions;
    snowLift: number;
    snowOverlayMinCoverage?: number;
}) {
    const visible = useSnowOverlayVisible({
        coverageMultiplier: snow.coverageMultiplier,
        minCoverage: snowOverlayMinCoverage,
        overrideSnow: snow.overrideSnow,
    });
    const overlayGeometry = useMemo(
        () => createSnowOverlayGeometry(geometry),
        [geometry],
    );
    const bounds = useMemo(() => {
        if (!overlayGeometry.boundingBox) {
            overlayGeometry.computeBoundingBox();
        }
        const box = overlayGeometry.boundingBox;
        if (!box) {
            return snow.bounds;
        }
        return {
            min: [box.min.x, box.min.y, box.min.z] as [number, number, number],
            max: [box.max.x, box.max.y, box.max.z] as [number, number, number],
        };
    }, [overlayGeometry, snow.bounds]);
    const material = useSnowMaterial({
        ...snow,
        bounds: snow.bounds ?? bounds,
    });
    const liftedTransform = useMemo(
        () => ({
            ...localTransform,
            position: [
                localTransform.position[0],
                localTransform.position[1] + (snowLift || 0.003),
                localTransform.position[2],
            ] as [number, number, number],
        }),
        [localTransform, snowLift],
    );

    if (!visible) {
        return null;
    }

    return chunks.map((chunk) => (
        <ChunkedInstancedMesh
            key={`snow:${chunk.key}`}
            castShadow={false}
            chunk={chunk}
            debugName={`SnowOverlay:${chunk.key}:count:${chunk.instances.length}`}
            geometry={overlayGeometry}
            localTransform={liftedTransform}
            material={material}
            materialNode={null}
            receiveShadow={false}
            scale={scale}
        />
    ));
}

function InstancedRainWetOverlays({
    chunks,
    geometry,
    localTransform,
    scale,
}: {
    chunks: MeshInstanceChunk<EntityBlockInstance>[];
    geometry: BufferGeometry;
    localTransform: MeshInstanceLocalTransform;
    scale: EntityInstancesBlockBaseProps['scale'];
}) {
    const visible = useRainWetOverlayVisible();

    if (!visible) {
        return null;
    }

    return (
        <VisibleInstancedRainWetOverlays
            chunks={chunks}
            geometry={geometry}
            localTransform={localTransform}
            scale={scale}
        />
    );
}

function VisibleInstancedRainWetOverlays({
    chunks,
    geometry,
    localTransform,
    scale,
}: {
    chunks: MeshInstanceChunk<EntityBlockInstance>[];
    geometry: BufferGeometry;
    localTransform: MeshInstanceLocalTransform;
    scale: EntityInstancesBlockBaseProps['scale'];
}) {
    const material = useRainWetOverlayMaterial({ geometry });

    return chunks.map((chunk) => (
        <ChunkedInstancedMesh
            key={`rain:${chunk.key}`}
            castShadow={false}
            chunk={chunk}
            debugName={`RainWetOverlay:${chunk.key}:count:${chunk.instances.length}`}
            geometry={geometry}
            localTransform={localTransform}
            material={material}
            materialNode={null}
            receiveShadow={false}
            scale={scale}
        />
    ));
}
