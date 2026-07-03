import { Edges } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import {
    type ComponentType,
    memo,
    type PropsWithChildren,
    useContext,
} from 'react';
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
import { useCurrentGardenCache } from '../hooks/useCurrentGarden';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { GameStateContext, useGameState } from '../useGameState';
import { useSetRaisedBedCloseupParam } from '../useRaisedBedCloseup';
import { useGiftBoxParam } from '../useUrlState';
import { useStackHeight } from '../utils/getStackHeight';
import { findRaisedBedByBlockId } from '../utils/raisedBedBlocks';
import { areEntityFactoryPropsEqual } from './entityFactoryMemo';
import { entityNameMap } from './entityNameMap';
import { QueuedPlacementDropAnimation } from './helpers/PlacementDropAnimation';
import { UnknownEntityPlaceholder } from './UnknownEntityPlaceholder';

export type EntityFactoryProps = {
    name: string;
    noControl?: boolean;
    noRenderInView?: string[];
};

type EntityFactoryComponentProps = EntityFactoryProps & EntityInstanceProps;

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
    const getCurrentGarden = useCurrentGardenCache();
    const gameStateStore = useContext(GameStateContext);
    const { track } = useGameAnalytics();
    const setHoveredBlock = useHoveredBlockStore(
        (state) => state.setHoveredBlock,
    );
    const setOpenGardenBoxBlockId = useGameState(
        (state) => state.setOpenGardenBoxBlockId,
    );
    const { mutate: setRaisedBedCloseupParam } = useSetRaisedBedCloseupParam();
    const [, setGiftBoxParam] = useGiftBoxParam();
    const selectable =
        block.name === 'GardenBox' ||
        block.name.startsWith('GiftBox_') ||
        block.name === 'Raised_Bed';
    const hasActiveDragPreview = () =>
        Boolean(gameStateStore?.getState().activeDragPreview);

    const handleSelected = useDeferredSingleClick(() => {
        if (hasActiveDragPreview()) {
            return;
        }

        if (block.name === 'GardenBox') {
            if (!getCurrentGarden()?.isSandbox) {
                setOpenGardenBoxBlockId(block.id);
            }
            return;
        }

        const garden = getCurrentGarden();
        const raisedBed =
            block.name === 'Raised_Bed'
                ? findRaisedBedByBlockId(garden, block.id)
                : null;
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
                      onPointerEnter: (event: ThreeEvent<PointerEvent>) => {
                          if (hasActiveDragPreview()) {
                              return;
                          }

                          event.stopPropagation();
                          setHoveredBlock(block);
                      },
                      onPointerLeave: (event: ThreeEvent<PointerEvent>) => {
                          if (
                              useHoveredBlockStore.getState().hoveredBlock ===
                              block
                          ) {
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

function EntityFactoryComponent({
    name,
    stack,
    block,
    noControl,
    noRenderInView,
    ...rest
}: EntityFactoryComponentProps) {
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

    const entity = EntityComponent ? (
        <EntityComponent stack={stack} block={block} {...rest} />
    ) : (
        <UnknownEntityPlaceholder
            stack={stack}
            block={block}
            rotation={rest.rotation}
        />
    );

    if (noControl || view === 'closeup') {
        return (
            <>
                <EntityRenderModeDebugOverlay
                    stack={stack}
                    block={block}
                    instanced={false}
                />
                {entity}
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
                {entity}
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

export const EntityFactory = memo(
    EntityFactoryComponent,
    areEntityFactoryPropsEqual,
);
