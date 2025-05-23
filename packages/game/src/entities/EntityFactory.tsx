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
import { Html } from "@react-three/drei";
import { ReactElement, SVGProps } from "react";
import { cx } from "@signalco/ui-primitives/cx";
import { Sprout } from "@signalco/ui-icons";
import { Modal } from "@signalco/ui-primitives/Modal";

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


function PlantPicker({ trigger }: { trigger: ReactElement }) {
    return (
        <Modal trigger={trigger} title={"Odabir biljke"} className="z-[99999999]">
            <div className="flex flex-col gap-2">
                <div className="flex flex-row gap-2">
                    <button
                        type="button"
                        className={cx(
                            "bg-white/30 size-full flex items-center justify-center rounded-sm",
                            "hover:bg-white/50 cursor-pointer"
                        )}>
                        <Sprout className="size-10" />
                    </button>
                </div>
            </div>
        </Modal>
    );
}

function ShovelIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            width={24}
            height={24}
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            className="lucide lucide-shovel-icon lucide-shovel"
            {...props}
        >
            <path d="M2 22v-5l5-5 5 5-5 5zM9.5 14.5 16 8M17 2l5 5-.5.5a3.53 3.53 0 0 1-5 0s0 0 0 0a3.53 3.53 0 0 1 0-5L17 2" />
        </svg>
    );
}

function RaisedBedField() {
    return (
        <div className="size-full grid grid-rows-3">
            {[...Array(3)].map((_, rowIndex) => (
                <div>
                    <div key={`${rowIndex}`} className="size-full grid grid-cols-3">
                        {[...Array(3)].map((_, colIndex) => (
                            <div key={`${rowIndex}-${colIndex}`} className="size-full p-0.5">
                                <PlantPicker
                                    trigger={(
                                        <button
                                            type="button"
                                            className={cx(
                                                "bg-gradient-to-br from-lime-200/90 to-green-200/80 size-full flex items-center justify-center rounded-sm",
                                                "hover:bg-white cursor-pointer"
                                            )}>
                                            <ShovelIcon className="size-10 stroke-green-800" />
                                        </button>
                                    )}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

export function EntityFactory({ name, stack, block, noControl, enableSelection, ...rest }: EntityFactoryProps & EntityInstanceProps) {
    const isEditMode = useIsEditMode();
    const EntityComponent = entityNameMap[name];
    const view = useGameState(state => state.view);
    const closeupBlock = useGameState(state => state.closeupBlock);
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
            <>
                <SelectableGroupWrapper
                    stack={stack}
                    block={block}>
                    <EntityComponent
                        stack={stack}
                        block={block}
                        {...rest} />
                </SelectableGroupWrapper>

                <Html center position={stack.position.clone()} className={cx(
                    "-top-[3px] size-[316px] opacity-0 transition-opacity pointer-events-none duration-300",
                    view === 'closeup' && block === closeupBlock && "opacity-100 [transition-delay:700ms] pointer-events-auto",
                )}>
                    {view === 'closeup' && block === closeupBlock && (
                        <RaisedBedField />
                        // {/* <Popper
                        //         open
                        //         onOpenChange={handleOpenChange}
                        //         // sideOffset={50}
                        //         anchor={<div />}
                        //         className="w-auto">
                        //         <BlockInfo block={block} />
                        //     </Popper> */}
                    )}
                </Html>
            </>
        );
    }

    return (
        <SelectableGroupWrapper
            stack={stack}
            block={block}>
            <PickableGroup
                stack={stack}
                block={block}
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
        </SelectableGroupWrapper>
    );
}