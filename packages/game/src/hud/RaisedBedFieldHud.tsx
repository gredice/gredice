import { Button } from "@signalco/ui-primitives/Button";
import { useGameState } from "../useGameState";
import { HudCard } from "./components/HudCard";
import { cx } from "@signalco/ui-primitives/cx";
import { useCurrentGarden } from "../hooks/useCurrentGarden";
import { RaisedBedField } from "./raisedBed/RaisedBedField";
import { Check } from "@signalco/ui-icons";

export function RaisedBedFieldHud() {
    const { data: currentGarden } = useCurrentGarden();
    const view = useGameState(state => state.view);
    const setView = useGameState(state => state.setView);
    const closeupBlock = useGameState(state => state.closeupBlock);
    const raisedBed = null;

    // console.log('raised bed', raisedBed.data);

    return (
        <>
            <div
                className={cx(
                    'absolute top-[calc(50%-3px)] left-1/2 size-[316px] -translate-x-1/2 -translate-y-1/2',
                    "opacity-0 transition-opacity pointer-events-none duration-300",
                    view === 'closeup' && "opacity-100 [transition-delay:950ms] pointer-events-auto",
                )}>
                {view === 'closeup' && (
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
            </div>
            <HudCard
                open={view === 'closeup'}
                position="floating"
                className="absolute md:px-1 bottom-2 left-1/2 -translate-x-1/2">
                <Button
                    variant='plain'
                    className='rounded-full'
                    onClick={() => {
                        setView({ view: 'normal' });
                    }}
                    startDecorator={<Check className="size-5" />}
                >
                    Završi uređivanje
                </Button>
            </HudCard>

        </>
    )
}
