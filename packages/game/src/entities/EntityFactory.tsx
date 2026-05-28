import { Edges } from '@react-three/drei';
import type { PropsWithChildren } from 'react';
import { PickableGroup } from '../controls/PickableGroup';
import { RotatableGroup } from '../controls/RotatableGroup';
import { SelectableGroup } from '../controls/SelectableGroup';
import { useBlockData } from '../hooks/useBlockData';
import { useIsEditMode } from '../hooks/useIsEditMode';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useGameState } from '../useGameState';
import { useStackHeight } from '../utils/getStackHeight';
import { entityNameMap } from './entityNameMap';

export type EntityFactoryProps = {
    name: string;
    noControl?: boolean;
    noRenderInView?: string[];
};

function InstancedEntityControlTarget({
    stack,
    block,
}: Pick<EntityInstanceProps, 'stack' | 'block'>) {
    const { data: blockData } = useBlockData();
    const currentStackHeight = useStackHeight(stack, block);
    const editHitboxDebugVisible = useGameState(
        (state) => state.editHitboxDebugVisible,
    );
    const blockHeight =
        blockData?.find((entity) => entity.information.name === block.name)
            ?.attributes.height ?? 1;
    const hitboxHeight = Math.max(blockHeight, 0.35);

    return (
        <mesh
            position={[
                stack.position.x,
                currentStackHeight + hitboxHeight / 2,
                stack.position.z,
            ]}
        >
            <boxGeometry args={[1, hitboxHeight, 1]} />
            <meshBasicMaterial visible={false} />
            {editHitboxDebugVisible && (
                <Edges color="#22d3ee" renderOrder={10_000} threshold={1} />
            )}
        </mesh>
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
    const isEditMode = useIsEditMode();
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
        if (!isEditMode) {
            return null;
        }

        const controlTarget = (
            <InstancedEntityControlTarget stack={stack} block={block} />
        );
        const isTopBlock =
            stack.blocks.indexOf(block) === stack.blocks.length - 1;

        if (!isTopBlock) {
            return (
                <RotatableGroup block={block}>{controlTarget}</RotatableGroup>
            );
        }

        return (
            <PickableGroup stack={stack} block={block} noControl={noControl}>
                <RotatableGroup block={block}>{controlTarget}</RotatableGroup>
            </PickableGroup>
        );
    }

    if (!isEditMode) {
        if (noControl) {
            return <EntityComponent stack={stack} block={block} {...rest} />;
        }

        const SelectableGroupWrapper =
            view !== 'closeup'
                ? SelectableGroup
                : (props: PropsWithChildren) => <>{props.children}</>;

        return (
            <SelectableGroupWrapper block={block}>
                <EntityComponent stack={stack} block={block} {...rest} />
            </SelectableGroupWrapper>
        );
    }

    // Non-top blocks are not pickable
    const isTopBlock = stack.blocks.indexOf(block) === stack.blocks.length - 1;
    if (!isTopBlock) {
        return (
            <RotatableGroup block={block}>
                <EntityComponent stack={stack} block={block} {...rest} />
            </RotatableGroup>
        );
    }

    return (
        <PickableGroup stack={stack} block={block} noControl={noControl}>
            <RotatableGroup block={block}>
                <EntityComponent stack={stack} block={block} {...rest} />
            </RotatableGroup>
        </PickableGroup>
    );
}
