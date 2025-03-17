import { Vector3 } from "three";
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
import { useBlockMove } from "../hooks/useBlockMove";

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

export function EntityFactory({ name, stack, block, noControl, ...rest }: { name: string, noControl?: boolean } & EntityInstanceProps) {
    const EntityComponent = entityNameMap[name];
    if (!EntityComponent) {
        return null;
    }

    // TODO: Move to PickableGroup
    const moveBlock = useBlockMove();
    const handlePositionChanged = async (movement: Vector3) => {
        await moveBlock.mutateAsync({
            sourcePosition: stack.position,
            destinationPosition: stack.position.clone().add(movement),
            blockIndex: stack.blocks.indexOf(block)
        });
    }

    return (
        <SelectableGroup
            block={block}>
            <PickableGroup
                stack={stack}
                block={block}
                onPositionChanged={handlePositionChanged}
                noControl={noControl}>
                <RotatableGroup
                    stack={stack}
                    block={block}>
                    <EntityComponent
                        stack={stack}
                        block={block}
                        {...rest} />
                </RotatableGroup>
            </PickableGroup>
        </SelectableGroup>
    );
}