import { EntityInstanceProps } from "../types/runtime/EntityInstanceProps";
import { PickableGroup } from "../controls/PickableGroup";
import { BlockGround } from "./BlockGround";
import { BlockGrass } from "./BlockGrass";
import { RaisedBed } from "./RaisedBed";
import { Shade } from "./Shade";
import { Fence } from "./Fence";
import { Stool } from "./Stool";
import { Bucket } from "./Bucket";
import { RotatableGroup } from "../controls/RotatableGroup";
import { RaisedBedContruction } from "./RaisedBedContruction";
import { SelectableGroup } from "../controls/SelectableGroup";
import { StoneSmall } from "./StoneSmall";
import { StoneMedium } from "./StoneMedium";
import { StoneLarge } from "./StoneLarge";
import { BlockSand } from "./BlockSand";
import { Composter } from "./Composter";
import { Bush } from "./Bush";
import { Tree } from "./Tree";
import { useIsEditMode } from "../hooks/useIsEditMode";
import { useGameState } from "../useGameState";

const entityNameMap: Record<string, any> = {
    "Block_Ground": BlockGround,
    "Block_Grass": BlockGrass,
    "Block_Sand": BlockSand,
    "Composter": Composter,
    "Raised_Bed": RaisedBed,
    "Shade": Shade,
    "Fence": Fence,
    "Stool": Stool,
    "Bucket": Bucket,
    "Bush": Bush,
    "Tree": Tree,
    "StoneSmall": StoneSmall,
    "StoneMedium": StoneMedium,
    "StoneLarge": StoneLarge,
    "Raised_Bed_Construction": RaisedBedContruction,
};

type EntityFactoryProps = {
    name: string;
    noControl?: boolean;
    enableSelection?: boolean;
};

export function EntityFactory({ name, stack, block, noControl, enableSelection, ...rest }: EntityFactoryProps & EntityInstanceProps) {
    const isEditMode = useIsEditMode();
    const EntityComponent = entityNameMap[name];
    const view = useGameState(state => state.view);

    if (!EntityComponent) {
        console.error(`Unknown entity: ${name} at ${stack.position.x}, ${stack.position.z}`);
        console.debug(stack);
        return null;
    }

    const SelectableGroupWrapper = view !== 'closeup' && enableSelection
        ? SelectableGroup
        : (props: any) => <>{props.children}</>;

    if (!isEditMode) {
        return (
            <SelectableGroupWrapper
                stack={stack}
                block={block}>
                <EntityComponent
                    stack={stack}
                    block={block}
                    {...rest} />
            </SelectableGroupWrapper>
        );
    }

    return (
        <PickableGroup
            stack={stack}
            block={block}
            noControl={noControl}>
            <RotatableGroup block={block}>
                <EntityComponent
                    stack={stack}
                    block={block}
                    {...rest} />
            </RotatableGroup>
        </PickableGroup>
    );
}