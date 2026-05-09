import type { PropsWithChildren } from 'react';
import { PickableGroup } from '../controls/PickableGroup';
import { RotatableGroup } from '../controls/RotatableGroup';
import { SelectableGroup } from '../controls/SelectableGroup';
import { useIsEditMode } from '../hooks/useIsEditMode';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useGameState } from '../useGameState';
import { entityNameMap } from './entityNameMap';

export type EntityFactoryProps = {
    name: string;
    noControl?: boolean;
    noRenderInView?: string[];
};

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

    if (!EntityComponent) {
        console.error(
            `Unknown entity: ${name} at ${stack.position.x}, ${stack.position.z}`,
        );
        console.debug(stack);
        return null;
    }

    if (!isEditMode) {
        if (noRenderInView?.includes(name)) {
            return null;
        }

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
