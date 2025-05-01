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
import { SelectableEditGroup } from "../controls/SelectableEditGroup";
import { useGameState } from "../useGameState";
import { useState } from "react";
import { Block } from "../types/Block";
import { HoveredBlockContext } from "../controls/useHoveredBlockStore";

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
    const isEditMode = useIsEditMode();
    const movingBlock = useGameState(state => state.movingBlock);

    const [hoveredBlock, setHoveredBlock] = useState<Block | null>(null);
    const hoveredContextState = {
        hoveredBlock,
        setHoveredBlock
    };

    const EntityComponent = entityNameMap[name];
    if (!EntityComponent) {
        console.error(`Unknown entity: ${name}`);
        return null;
    }

    if (!isEditMode) {
        return (
            <HoveredBlockContext.Provider value={hoveredContextState}>
                <SelectableGroup
                    block={block}>
                    <EntityComponent
                        stack={stack}
                        block={block}
                        {...rest} />
                </SelectableGroup>
            </HoveredBlockContext.Provider>
        );
    }

    // In edit mode, wrap the entity in a PickableGroup 
    // if entity is assigned as moving block
    if (movingBlock === block.id) {
        return (
            <HoveredBlockContext.Provider value={hoveredContextState}>
                <SelectableEditGroup
                    block={block}>
                    <PickableGroup
                        stack={stack}
                        block={block}>
                        <RotatableGroup
                            block={block}>
                            <EntityComponent
                                stack={stack}
                                block={block}
                                {...rest} />
                        </RotatableGroup>
                    </PickableGroup>
                </SelectableEditGroup>
            </HoveredBlockContext.Provider>
        )
    }

    return (
        <HoveredBlockContext.Provider value={hoveredContextState}>
            <SelectableEditGroup
                block={block}>
                <RotatableGroup
                    block={block}>
                    <EntityComponent
                        stack={stack}
                        block={block}
                        {...rest} />
                </RotatableGroup>
            </SelectableEditGroup>
        </HoveredBlockContext.Provider>
    );
}