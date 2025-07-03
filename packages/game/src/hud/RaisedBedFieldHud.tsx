import { useGameState } from "../useGameState";
import { cx } from "@signalco/ui-primitives/cx";
import { useCurrentGarden } from "../hooks/useCurrentGarden";
import { RaisedBedField } from "./raisedBed/RaisedBedField";
import { Check, Edit } from "@signalco/ui-icons";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Row } from "@signalco/ui-primitives/Row";
import { RaisedBedSensorInfo } from "./raisedBed/RaisedBedSensorInfo";
import { ButtonGreen } from "../shared-ui/ButtonGreen";
import { RaisedBedInfo } from "../controls/components/RaisedBedInfo";
import { Modal } from "@signalco/ui-primitives/Modal";

export function RaisedBedFieldHud() {
    const { data: currentGarden } = useCurrentGarden();
    const view = useGameState(state => state.view);
    const setView = useGameState(state => state.setView);
    const closeupBlock = useGameState(state => state.closeupBlock);
    const raisedBed = currentGarden?.raisedBeds.find((bed) => bed.blockId === closeupBlock?.id);

    return (
        <>
            <div className={cx(
                "opacity-0 transition-opacity pointer-events-none duration-300",
                view === 'closeup' && "opacity-100 [transition-delay:950ms] pointer-events-auto",
            )}>
                {(currentGarden && raisedBed) && (
                    <div className="absolute max-w-64 md:max-w-[312px] top-[calc(50%-203.5px)] left-[calc(50%-156.5px)]">
                        <Modal
                            title="Informacije o gredici"
                            trigger={(
                                <ButtonGreen fullWidth>
                                    <Row spacing={1}>
                                        <Edit className="size-5 shrink-0" />
                                        <Typography semiBold noWrap>{raisedBed?.name}</Typography>
                                    </Row>
                                </ButtonGreen>
                            )}>
                            <RaisedBedInfo gardenId={currentGarden.id} raisedBed={raisedBed} />
                        </Modal>
                    </div>
                )}
                <div
                    className='absolute top-[calc(50%-3px)] left-1/2 size-[316px] -translate-x-1/2 -translate-y-1/2'>
                    {view === 'closeup' && (
                        <>
                            {currentGarden && raisedBed && (
                                <RaisedBedField
                                    gardenId={currentGarden.id}
                                    raisedBedId={raisedBed.id}
                                />
                            )}
                        </>
                    )}
                </div>
                {currentGarden && raisedBed && (
                    <div className="absolute top-[calc(50%+160px)] left-[calc(50%-156.5px)] md:left-[calc(50%+210px)] md:top-[calc(50%+118px)]">
                        <RaisedBedSensorInfo
                            gardenId={currentGarden.id}
                            raisedBedId={raisedBed.id} />
                    </div>
                )}
                <ButtonGreen
                    variant='plain'
                    className={cx(
                        "absolute top-[calc(50%-203.5px)] md:left-[calc(50%+210px)] md:size-auto",
                        "rounded-full size-10 left-[calc(50%+118px)]",
                    )}
                    onClick={() => {
                        setView({ view: 'normal' });
                    }}
                    startDecorator={<Check className="size-5 shrink-0" />}
                >
                    <span className="hidden md:block">Završi uređivanje</span>
                </ButtonGreen>
            </div>
        </>
    )
}
