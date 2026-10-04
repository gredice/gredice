import { Edges } from '@react-three/drei';
import { type ComponentType, memo, type PropsWithChildren } from 'react';
import { PickableGroup } from '../controls/PickableGroup';
import { RotatableGroup } from '../controls/RotatableGroup';
import { SelectableGroup } from '../controls/SelectableGroup';
import { useBlockData } from '../hooks/useBlockData';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useGameState } from '../useGameState';
import { useStackHeight } from '../utils/getStackHeight';
import { areEntityFactoryPropsEqual } from './entityFactoryMemo';
import { entityNameMap } from './entityNameMap';
import { QueuedPlacementDropAnimation } from './helpers/PlacementDropAnimation';
import { isEnvironmentAnimalEntityName } from './ladybugs/environmentAnimalPolicy';
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

function EntityFactoryComponent({
    name,
    stack,
    block,
    noControl,
    noRenderInView,
    ...rest
}: EntityFactoryComponentProps) {
    const view = useGameState((state) => state.view);

    if (isEnvironmentAnimalEntityName(name)) {
        return null;
    }

    const EntityComponent = entityComponents[name];
    const isInstancedInView = noRenderInView?.includes(name) ?? false;

    if (isInstancedInView) {
        return (
            <EntityRenderModeDebugOverlay
                stack={stack}
                block={block}
                instanced
            />
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
