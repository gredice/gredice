import { Vector3 } from "three";
import { useGameState } from "../useGameState";
import { entities } from "../data/entities";
import { EntityInstanceProps } from "../types/runtime/EntityInstanceProps";
import { PickableGroup } from "../controls/PickableGroup";
import { BlockGround } from "./BlockGround";
import { BlockGrass } from "./BlockGrass";
import { RaisedBed } from "./RaisedBed";
import { Shade } from "./Shade";
import { Fence } from "./Fence";
import { Bucket } from "./Bucket";

const entityNameMap = {
    [entities.BlockGround.name]: BlockGround,
    [entities.BlockGrass.name]: BlockGrass,
    [entities.RaisedBed.name]: RaisedBed,
    [entities.Shade.name]: Shade,
    [entities.Fence.name]: Fence,
    [entities.Bucket.name]: Bucket
}

export function EntityFactory({ name, stack, block, noControl, ...rest }: { name: string, noControl?: boolean } & EntityInstanceProps) {
    const EntityComponent = entityNameMap[name];
    if (!EntityComponent) {
        return null;
    }

    const moveBlock = useGameState(state => state.moveBlock);
    const handlePositionChanged = (movement: Vector3) => {
        const dest = stack.position.clone().add(movement);
        const blockIndex = stack.blocks.indexOf(block);
        moveBlock(stack.position, blockIndex, dest);
    }

    return (
        <PickableGroup
            stack={stack}
            block={block}
            onPositionChanged={handlePositionChanged}
            noControl={noControl}>
            <EntityComponent
                stack={stack}
                block={block}
                {...rest} />
        </PickableGroup>
    );
}