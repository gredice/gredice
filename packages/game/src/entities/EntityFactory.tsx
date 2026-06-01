import { Edges } from '@react-three/drei';
import type { PropsWithChildren } from 'react';
import { PickableGroup } from '../controls/PickableGroup';
import { RotatableGroup } from '../controls/RotatableGroup';
import { SelectableGroup } from '../controls/SelectableGroup';
import { useDeferredSingleClick } from '../controls/useDeferredSingleClick';
import { useBlockData } from '../hooks/useBlockData';
import { useIsSandboxGarden } from '../hooks/useCurrentGarden';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useGameState } from '../useGameState';
import { getBlockHitboxSize } from '../utils/blockHitbox';
import { useStackHeight } from '../utils/getStackHeight';
import { entityNameMap } from './entityNameMap';
import { QueuedPlacementDropAnimation } from './helpers/PlacementDropAnimation';

export type EntityFactoryProps = {
    name: string;
    noControl?: boolean;
    noRenderInView?: string[];
};

const instancedRenderModeDebugColor = '#22c55e';
const componentRenderModeDebugColor = '#f59e0b';

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

function InstancedEntityControlTarget({
    stack,
    block,
}: Pick<EntityInstanceProps, 'stack' | 'block'>) {
    const { data: blockData } = useBlockData();
    const currentStackHeight = useStackHeight(stack, block);
    const editHitboxDebugVisible = useGameState(
        (state) => state.editHitboxDebugVisible,
    );
    const blockEntity = blockData?.find(
        (entity) => entity.information.name === block.name,
    );
    const hitbox = getBlockHitboxSize(blockEntity);
    const hasActiveDragPreview = useGameState((state) =>
        Boolean(state.activeDragPreview),
    );
    const isSandbox = useIsSandboxGarden();
    const setOpenGardenBoxBlockId = useGameState(
        (state) => state.setOpenGardenBoxBlockId,
    );
    const handleGardenBoxClick = useDeferredSingleClick(() => {
        if (block.name !== 'GardenBox' || isSandbox || hasActiveDragPreview) {
            return;
        }

        setOpenGardenBoxBlockId(block.id);
    });

    return (
        // biome-ignore lint/a11y/noStaticElementInteractions: Three.js mesh is an invisible block interaction target.
        <mesh
            onClick={
                block.name === 'GardenBox' ? handleGardenBoxClick : undefined
            }
            position={[
                stack.position.x,
                currentStackHeight + hitbox.height / 2,
                stack.position.z,
            ]}
            rotation={[0, block.rotation * (Math.PI / 2), 0]}
        >
            <boxGeometry args={[hitbox.width, hitbox.height, hitbox.depth]} />
            <meshBasicMaterial visible={false} />
            {editHitboxDebugVisible && (
                <Edges color="#22d3ee" renderOrder={10_000} threshold={1} />
            )}
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

export function EntityFactory({
    name,
    stack,
    block,
    noControl,
    noRenderInView,
    ...rest
}: EntityFactoryProps & EntityInstanceProps) {
    const EntityComponent = entityNameMap[name];
    const view = useGameState((state) => state.view);
    const isInstancedInView = noRenderInView?.includes(name) ?? false;

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
            <SelectableGroup block={block}>
                <PickableGroup
                    stack={stack}
                    block={block}
                    noControl={noControl}
                    renderPickupOutline={false}
                >
                    <RotatableGroup block={block}>
                        <InstancedEntityControlTarget
                            stack={stack}
                            block={block}
                        />
                        <EntityRenderModeDebugOverlay
                            stack={stack}
                            block={block}
                            instanced
                        />
                    </RotatableGroup>
                </PickableGroup>
            </SelectableGroup>
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
