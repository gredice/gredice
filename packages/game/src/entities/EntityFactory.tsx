import type { PropsWithChildren } from 'react';
import { PickableGroup } from '../controls/PickableGroup';
import { RotatableGroup } from '../controls/RotatableGroup';
import { SelectableGroup } from '../controls/SelectableGroup';
import { useIsEditMode } from '../hooks/useIsEditMode';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useGameState } from '../useGameState';
import { BlockGrass } from './BlockGrass';
import { BlockGround } from './BlockGround';
import { BlockSand } from './BlockSand';
import { Bucket } from './Bucket';
import { Bush } from './Bush';
import { Composter } from './Composter';
import { Fence } from './Fence';
import { RaisedBed } from './RaisedBed';
import { Shade } from './Shade';
import { StoneLarge } from './StoneLarge';
import { StoneMedium } from './StoneMedium';
import { StoneSmall } from './StoneSmall';
import { Stool } from './Stool';
import { Tree } from './Tree';

const entityNameMap: Record<
    string,
    React.ComponentType<EntityInstanceProps>
> = {
    Block_Ground: BlockGround,
    Block_Grass: BlockGrass,
    Block_Sand: BlockSand,
    Composter: Composter,
    Raised_Bed: RaisedBed,
    Shade: Shade,
    Fence: Fence,
    Stool: Stool,
    Bucket: Bucket,
    Bush: Bush,
    Tree: Tree,
    StoneSmall: StoneSmall,
    StoneMedium: StoneMedium,
    StoneLarge: StoneLarge,
};

type EntityFactoryProps = {
    name: string;
    noControl?: boolean;
};

export function EntityFactory({
    name,
    stack,
    block,
    noControl,
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

    const SelectableGroupWrapper =
        view !== 'closeup'
            ? SelectableGroup
            : (props: PropsWithChildren) => <>{props.children}</>;

    if (!isEditMode) {
        return (
            <SelectableGroupWrapper block={block}>
                <EntityComponent stack={stack} block={block} {...rest} />
            </SelectableGroupWrapper>
        );
    }

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
