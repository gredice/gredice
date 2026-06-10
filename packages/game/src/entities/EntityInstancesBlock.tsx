import {
    cloneElement,
    isValidElement,
    type ReactNode,
    useLayoutEffect,
    useMemo,
    useRef,
} from 'react';
import {
    Euler,
    type InstancedMesh,
    type Material,
    Matrix4,
    Quaternion,
    Vector3,
} from 'three';
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
import { blockPickupOutlineStyle } from './helpers/blockPickupOutlineStyle';
import { HoverOutline } from './helpers/HoverOutline';
import { PlacementDropAnimation } from './helpers/PlacementDropAnimation';

const defaultLocalPosition: [number, number, number] = [0, 0, 0];
const defaultLocalRotation: [number, number, number] = [0, 0, 0];
const instanceChunkSize = 8;

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

type InstanceChunk = {
    key: string;
    instances: EntityBlockInstance[];
};

function chunkInstanceKey(position: [number, number, number]) {
    return `${Math.floor(position[0] / instanceChunkSize)}:${Math.floor(
        position[2] / instanceChunkSize,
    )}`;
}

function chunkInstances(instances: EntityBlockInstance[]) {
    const chunkByKey = new Map<string, EntityBlockInstance[]>();

    for (const instance of instances) {
        const key = chunkInstanceKey(instance.position);
        const chunk = chunkByKey.get(key);
        if (chunk) {
            chunk.push(instance);
            continue;
        }
        chunkByKey.set(key, [instance]);
    }

    return [...chunkByKey.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(
            ([key, chunk]): InstanceChunk => ({
                key,
                instances: chunk,
            }),
        );
}

function createInstanceMatrix(
    instance: EntityBlockInstance,
    localTransform: {
        position: [number, number, number];
        rotation: [number, number, number];
    },
    scale: EntityInstancesBlockBaseProps['scale'],
) {
    const rootPosition = new Vector3(...instance.position);
    const rootQuaternion = new Quaternion().setFromAxisAngle(
        new Vector3(0, 1, 0),
        instance.rotation * (Math.PI / 2),
    );
    const rootScale = new Vector3(1, 1, 1);
    const rootMatrix = new Matrix4().compose(
        rootPosition,
        rootQuaternion,
        rootScale,
    );
    const localPosition = new Vector3(...localTransform.position);
    const localQuaternion = new Quaternion().setFromEuler(
        new Euler(...localTransform.rotation),
    );
    const localScale = Array.isArray(scale)
        ? new Vector3(scale[0], scale[1], scale[2])
        : new Vector3(scale ?? 1, scale ?? 1, scale ?? 1);
    const localMatrix = new Matrix4().compose(
        localPosition,
        localQuaternion,
        localScale,
    );

    return rootMatrix.multiply(localMatrix);
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
    blockNameByActiveDragTargetKey: Map<string, string>,
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
    blockNameByActiveDragTargetKey: Map<string, string>,
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
    const blockNameByActiveDragTargetKey = useMemo(() => {
        const lookup = new Map<string, string>();

        for (const stack of stacks ?? []) {
            stack.blocks.forEach((block, blockIndex) => {
                lookup.set(
                    `${stack.position.x}|${stack.position.z}|${block.id}|${blockIndex}`,
                    block.name,
                );
            });
        }

        return lookup;
    }, [stacks]);
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

    return stacks
        ?.filter((stack) =>
            stack.blocks.some((block) =>
                blockNameMatches(block.name, name, names),
            ),
        )
        .flatMap((stack) =>
            stack.blocks
                .map((block, blockIndex) => ({ block, blockIndex }))
                .filter(({ block }) =>
                    blockNameMatches(block.name, name, names),
                )
                .map(({ block, blockIndex }): EntityBlockInstance => {
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
                }),
        );
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
        castShadow = true,
        receiveShadow = true,
        renderOrder,
    } = props;
    const placementDropAnimations = useGameState(
        (state) => state.blockPlacementDropAnimations,
    );

    if (!instances?.length) {
        return null;
    }

    const localTransform = {
        position: localPosition ?? defaultLocalPosition,
        rotation: localRotation ?? defaultLocalRotation,
    };
    const animatedBlockIds = new Set(Object.keys(placementDropAnimations));
    const stableInstances = instances.filter(
        (data) => !animatedBlockIds.has(data.block.id),
    );
    const animatedInstances = instances.filter((data) =>
        animatedBlockIds.has(data.block.id),
    );
    const stableChunks = chunkInstances(stableInstances);

    const material = 'material' in props ? props.material : undefined;
    const materialNode = 'materialNode' in props ? props.materialNode : null;

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
                        scale={scale}
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
                              scale={scale}
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
                              scale={scale}
                          >
                              <RainWetOverlay geometry={geometry} />
                          </group>
                      </group>
                  </PlacementDropAnimation>
              ));

    return (
        <>
            {stableChunks.map((chunk) => (
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
                    scale={scale}
                />
            ))}
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
                                scale={scale}
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
                    scale={scale}
                />
            )}
            {snow && renderSnow && (
                <InstancedSnowOverlays
                    chunks={stableChunks}
                    geometry={geometry}
                    localTransform={localTransform}
                    scale={scale}
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
    chunk: InstanceChunk;
    debugName: string;
    geometry: BufferGeometry;
    localTransform: {
        position: [number, number, number];
        rotation: [number, number, number];
    };
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
                createInstanceMatrix(instance, localTransform, scale),
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

function InstancedSnowOverlays({
    chunks,
    geometry,
    localTransform,
    scale,
    snow,
    snowLift,
    snowOverlayMinCoverage,
}: {
    chunks: InstanceChunk[];
    geometry: BufferGeometry;
    localTransform: {
        position: [number, number, number];
        rotation: [number, number, number];
    };
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
    chunks: InstanceChunk[];
    geometry: BufferGeometry;
    localTransform: {
        position: [number, number, number];
        rotation: [number, number, number];
    };
    scale: EntityInstancesBlockBaseProps['scale'];
}) {
    const visible = useRainWetOverlayVisible();
    const material = useRainWetOverlayMaterial({ geometry });

    if (!visible) {
        return null;
    }

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
