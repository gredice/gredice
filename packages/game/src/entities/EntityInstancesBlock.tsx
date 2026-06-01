import { Instance, Instances } from '@react-three/drei';
import { type ReactNode, useMemo } from 'react';
import type { Material } from 'three';
import type { BufferGeometry } from 'three/src/Three.Core.js';
import {
    type ActiveDragPreviewTarget,
    activeDragPreviewTargetMatches,
    createActiveDragPreviewTarget,
    getActiveDragPreviewTargetPositionOffset,
} from '../dragPreviewIdentity';
import { useBlockData } from '../hooks/useBlockData';
import { RainWetOverlay } from '../rain/RainWetOverlay';
import { type SnowMaterialOptions, SnowOverlay } from '../snow/SnowOverlay';
import type { Block } from '../types/Block';
import type { Stack } from '../types/Stack';
import { type ActiveDragPreview, useGameState } from '../useGameState';
import { getStackHeight } from '../utils/getStackHeight';
import { resolveBlockInstanceCapacity } from './blockInstanceCapacity';
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

    const instanceCapacity = resolveBlockInstanceCapacity(instances.length);

    const localTransform = {
        position: localPosition ?? defaultLocalPosition,
        rotation: localRotation ?? defaultLocalRotation,
    };

    const renderInstances = (suffix: string) =>
        (instances ?? []).map((data) => (
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
                    <Instance
                        position={localTransform.position}
                        rotation={localTransform.rotation}
                        scale={scale}
                    />
                </group>
            </PlacementDropAnimation>
        ));

    const renderSnowOverlays = () =>
        !snow || !renderSnow
            ? null
            : (instances ?? []).map((data) => (
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

    const renderRainOverlays = () =>
        !renderRainWetOverlay
            ? null
            : (instances ?? []).map((data) => (
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
            <Instances
                key={`${instanceKey}-${instanceCapacity}`}
                limit={instanceCapacity}
                range={instances.length}
                geometry={geometry}
                frustumCulled={false}
                receiveShadow={receiveShadow}
                castShadow={castShadow}
                renderOrder={renderOrder}
                material={'material' in props ? props.material : undefined}
            >
                {'materialNode' in props ? props.materialNode : null}
                {renderInstances('base')}
            </Instances>
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
            {renderRainOverlays()}
            {renderSnowOverlays()}
        </>
    );
}
