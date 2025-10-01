import type { PropsWithChildren } from 'react';
import { PickableGroup } from '../controls/PickableGroup';
import { RotatableGroup } from '../controls/RotatableGroup';
import { SelectableGroup } from '../controls/SelectableGroup';
import { useView } from '../GameHud';
import { useIsEditMode } from '../hooks/useIsEditMode';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useGameState } from '../useGameState';
import { BaleHey } from './BaleHey';
import { BlockGrass } from './BlockGrass';
import { BlockGrassAngle } from './BlockGrassAngle';
import { BlockGround } from './BlockGround';
import { BlockGroundAngle } from './BlockGroundAngle';
import { BlockSand } from './BlockSand';
import { BlockSandAngle } from './BlockSandAngle';
import { Bucket } from './Bucket';
import { Bush } from './Bush';
import { Composter } from './Composter';
import { Fence } from './Fence';
import { Pine } from './Pine';
import { RaisedBed } from './RaisedBed';
import { MulchCoconut } from './raisedBed/MulchCoconut';
import { MulchHey } from './raisedBed/MulchHey';
import { MulchWood } from './raisedBed/MulchWood';
import { Seed } from './raisedBed/Seed';
import { Stick } from './raisedBed/Stick';
import { Shade } from './Shade';
import { ShovelSmall } from './ShovelSmall';
import { StoneLarge } from './StoneLarge';
import { StoneMedium } from './StoneMedium';
import { StoneSmall } from './StoneSmall';
import { Stool } from './Stool';
import { Tree } from './Tree';
import { Tulip } from './Tulip';

export const entityNameMap: Record<
    string,
    React.ComponentType<EntityInstanceProps>
> = {
    Block_Ground: BlockGround,
    Block_Grass: BlockGrass,
    Block_Sand: BlockSand,
    Block_Ground_Angle: BlockGroundAngle,
    Block_Grass_Angle: BlockGrassAngle,
    Block_Sand_Angle: BlockSandAngle,
    Composter: Composter,
    Raised_Bed: RaisedBed,
    Shade: Shade,
    Fence: Fence,
    Stool: Stool,
    Bucket: Bucket,
    Bush: Bush,
    Tree: Tree,
    Pine: Pine,
    StoneSmall: StoneSmall,
    StoneMedium: StoneMedium,
    StoneLarge: StoneLarge,
    ShovelSmall: ShovelSmall,
    Tulip: Tulip,
    BaleHey: BaleHey,

    // Raised bed items
    MulchHey: MulchHey,
    MulchCoconut: MulchCoconut,
    MulchWood: MulchWood,
    Stick: Stick,
    Seed: Seed,
};

type EntityFactoryProps = {
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
    const [viewData] = useView();

    if (!EntityComponent) {
        console.error(
            `Unknown entity: ${name} at ${stack.position.x}, ${stack.position.z}`,
        );
        console.debug(stack);
        return null;
    }

    const SelectableGroupWrapper =
        viewData.view !== 'closeup'
            ? SelectableGroup
            : (props: PropsWithChildren) => <>{props.children}</>;

    if (!isEditMode) {
        if (noRenderInView?.includes(name)) {
            return null;
        }

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
