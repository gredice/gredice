import { Edges } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { type ComponentType, type PropsWithChildren, useEffect } from 'react';
import { useGameAnalytics } from '../analytics/GameAnalyticsContext';
import {
    createBlockInteractionTargetKey,
    useBlockInteractionTargetRegistration,
} from '../controls/BlockInteractionRegistry';
import { PickableGroup } from '../controls/PickableGroup';
import { RotatableGroup } from '../controls/RotatableGroup';
import { SelectableGroup } from '../controls/SelectableGroup';
import { useDeferredSingleClick } from '../controls/useDeferredSingleClick';
import { useHoveredBlockStore } from '../controls/useHoveredBlockStore';
import { useBlockData } from '../hooks/useBlockData';
import {
    useCurrentGarden,
    useIsSandboxGarden,
} from '../hooks/useCurrentGarden';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useGameState } from '../useGameState';
import { useSetRaisedBedCloseupParam } from '../useRaisedBedCloseup';
import { useGiftBoxParam } from '../useUrlState';
import { useStackHeight } from '../utils/getStackHeight';
import { findRaisedBedByBlockId } from '../utils/raisedBedBlocks';
import { entityNameMap } from './entityNameMap';
import { QueuedPlacementDropAnimation } from './helpers/PlacementDropAnimation';

export type EntityFactoryProps = {
    name: string;
    noControl?: boolean;
    noRenderInView?: string[];
};

const instancedRenderModeDebugColor = '#22c55e';
const componentRenderModeDebugColor = '#f59e0b';
const entityComponents: Record<
    string,
    ComponentType<EntityInstanceProps>
> = entityNameMap;

function EntityRenderModeDebugOverlay({
    stack,
    block,
    instanced,
}: Pick<EntityInstanceProps, 'stack' | 'block'> & { instanced: boolean }) {
    const { data: blockData } = useBlockData();
    const currentStackHeight = useStackHeight(stack, block);
    const visible = useGameState((state) => state.entityRenderModeDebugVisible);

    if (!visible) {
        return null;
    }

    const blockHeight =
        blockData?.find((entity) => entity.information.name === block.name)
            ?.attributes.height ?? 1;
    const overlayHeight = Math.max(blockHeight, 0.35);
    const overlayScale = 1.05;

    return (
        <mesh
            name={`Debug:EntityRenderMode:${instanced ? 'instanced' : 'component'}:${block.name}:${block.id}`}
            position={[
                stack.position.x,
                currentStackHeight + overlayHeight / 2,
                stack.position.z,
            ]}
            scale={[overlayScale, 1.02, overlayScale]}
            renderOrder={10_001}
            raycast={() => null}
        >
            <boxGeometry args={[1, overlayHeight, 1]} />
            <meshBasicMaterial visible={false} />
            <Edges
                color={
                    instanced
                        ? instancedRenderModeDebugColor
                        : componentRenderModeDebugColor
                }
                renderOrder={10_001}
                threshold={1}
            />
        </mesh>
    );
}

function EntityPlacementDropAnimation({
    children,
    stack,
    block,
}: PropsWithChildren<Pick<EntityInstanceProps, 'stack' | 'block'>>) {
    const currentStackHeight = useStackHeight(stack, block);

    return (
        <QueuedPlacementDropAnimation
            block={block}
            particlePosition={[
                stack.position.x,
                currentStackHeight,
                stack.position.z,
            ]}
        >
            {children}
        </QueuedPlacementDropAnimation>
    );
}

function InstancedEntitySelectionRegistration({
    block,
    blockIndex,
    interactionTargetKey,
    stack,
}: Pick<EntityInstanceProps, 'stack' | 'block'> & {
    blockIndex: number;
    interactionTargetKey: string | undefined;
}) {
    const { data: garden } = useCurrentGarden();
    const { track } = useGameAnalytics();
    const hoveredBlock = useHoveredBlockStore((state) => state.hoveredBlock);
    const setHoveredBlock = useHoveredBlockStore(
        (state) => state.setHoveredBlock,
    );
    const isSandbox = useIsSandboxGarden();
    const hasActiveDragPreview = useGameState((state) =>
        Boolean(state.activeDragPreview),
    );
    const setOpenGardenBoxBlockId = useGameState(
        (state) => state.setOpenGardenBoxBlockId,
    );
    const { mutate: setRaisedBedCloseupParam } = useSetRaisedBedCloseupParam();
    const [, setGiftBoxParam] = useGiftBoxParam();
    const raisedBed =
        block.name === 'Raised_Bed'
            ? findRaisedBedByBlockId(garden, block.id)
            : null;
    const selectable =
        block.name === 'GardenBox' ||
        block.name.startsWith('GiftBox_') ||
        Boolean(raisedBed);
    const selectionHoverEnabled = selectable && !hasActiveDragPreview;

    useEffect(() => {
        if (hasActiveDragPreview && hoveredBlock === block) {
            setHoveredBlock(null);
        }
    }, [block, hasActiveDragPreview, hoveredBlock, setHoveredBlock]);

    const handleSelected = useDeferredSingleClick(() => {
        if (hasActiveDragPreview) {
            return;
        }

        if (block.name === 'GardenBox') {
            if (!isSandbox) {
                setOpenGardenBoxBlockId(block.id);
            }
            return;
        }

        if (block.name === 'Raised_Bed' && raisedBed) {
            track('game_raised_bed_opened', {
                block_id: block.id,
                raised_bed_name: raisedBed.name,
            });
            setRaisedBedCloseupParam(raisedBed.name);
            setHoveredBlock(null);
            return;
        }

        if (block.name.startsWith('GiftBox_')) {
            setGiftBoxParam(block.id);
        }
    });

    useBlockInteractionTargetRegistration(
        interactionTargetKey,
        interactionTargetKey
            ? {
                  block,
                  blockIndex,
                  stack,
              }
            : undefined,
        {
            onSelectClick: (event: ThreeEvent<MouseEvent>) => {
                handleSelected(event);
            },
            ...(selectable
                ? {
                      ...(selectionHoverEnabled
                          ? {
                                onPointerEnter: (
                                    event: ThreeEvent<PointerEvent>,
                                ) => {
                                    event.stopPropagation();
                                    setHoveredBlock(block);
                                },
                            }
                          : {}),
                      onPointerLeave: (event: ThreeEvent<PointerEvent>) => {
                          if (hoveredBlock === block) {
                              event.stopPropagation();
                              setHoveredBlock(null);
                          }
                      },
                  }
                : {}),
        },
    );

    return null;
}

export function EntityFactory({
    name,
    stack,
    block,
    noControl,
    noRenderInView,
    ...rest
}: EntityFactoryProps & EntityInstanceProps) {
    const EntityComponent = entityComponents[name];
    const view = useGameState((state) => state.view);
    const isInstancedInView = noRenderInView?.includes(name) ?? false;
    const blockIndex = stack.blocks.indexOf(block);
    const interactionTargetKey = isInstancedInView
        ? createBlockInteractionTargetKey({
              blockId: block.id,
              blockIndex,
              stackPosition: stack.position,
          })
        : undefined;

    if (!EntityComponent) {
        console.error(
            `Unknown entity: ${name} at ${stack.position.x}, ${stack.position.z}`,
        );
        console.debug(stack);
        return null;
    }

    if (isInstancedInView) {
        if (noControl || view === 'closeup') {
            return (
                <EntityRenderModeDebugOverlay
                    stack={stack}
                    block={block}
                    instanced
                />
            );
        }

        return (
            <>
                <InstancedEntitySelectionRegistration
                    block={block}
                    blockIndex={blockIndex}
                    interactionTargetKey={interactionTargetKey}
                    stack={stack}
                />
                <PickableGroup
                    stack={stack}
                    block={block}
                    interactionTargetKey={interactionTargetKey}
                    noControl={noControl}
                    renderPickupOutline={false}
                >
                    <RotatableGroup
                        block={block}
                        blockIndex={blockIndex}
                        interactionTargetKey={interactionTargetKey}
                        stack={stack}
                    >
                        <EntityRenderModeDebugOverlay
                            stack={stack}
                            block={block}
                            instanced
                        />
                    </RotatableGroup>
                </PickableGroup>
            </>
        );
    }

    if (noControl || view === 'closeup') {
        return (
            <>
                <EntityRenderModeDebugOverlay
                    stack={stack}
                    block={block}
                    instanced={false}
                />
                <EntityComponent stack={stack} block={block} {...rest} />
            </>
        );
    }

    const entityContent = (
        <EntityPlacementDropAnimation stack={stack} block={block}>
            <RotatableGroup block={block}>
                <EntityRenderModeDebugOverlay
                    stack={stack}
                    block={block}
                    instanced={false}
                />
                <EntityComponent stack={stack} block={block} {...rest} />
            </RotatableGroup>
        </EntityPlacementDropAnimation>
    );

    return (
        <SelectableGroup block={block}>
            <PickableGroup stack={stack} block={block} noControl={noControl}>
                {entityContent}
            </PickableGroup>
        </SelectableGroup>
    );
}
