import { RaisedBedIcon } from '@gredice/ui/RaisedBedIcon';
import { Check } from '@signalco/ui-icons';
import { cx } from '@signalco/ui-primitives/cx';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import { ButtonGreen } from '../shared-ui/ButtonGreen';
import { useGameState } from '../useGameState';
import { RaisedBedField } from './raisedBed/RaisedBedField';
import { RaisedBedFieldSuggestions } from './raisedBed/RaisedBedFieldSuggestions';
import { RaisedBedInfo } from './raisedBed/RaisedBedInfo';
import { RaisedBedSensorInfo } from './raisedBed/RaisedBedSensorInfo';
import { RaisedBedWatering } from './raisedBed/RaisedBedWatering';

export function RaisedBedFieldHud(_props: {
    flags?: {
        enableRaisedBedWateringFlag?: boolean;
        enableRaisedBedDiaryFlag?: boolean;
        enableRaisedBedOperationsFlag?: boolean;
        enableRaisedBedFieldOperationsFlag?: boolean;
        enableRaisedBedFieldWateringFlag?: boolean;
        enableRaisedBedFieldDiaryFlag?: boolean;
    };
}) {
    const { data: currentGarden } = useCurrentGarden();
    const view = useGameState((state) => state.view);
    const setView = useGameState((state) => state.setView);
    const closeupBlock = useGameState((state) => state.closeupBlock);
    const raisedBed = currentGarden?.raisedBeds.find(
        (bed) => bed.blockId === closeupBlock?.id,
    );

    return (
        <div
            className={cx(
                'opacity-0 transition-opacity pointer-events-none duration-300',
                view === 'closeup' &&
                    'opacity-100 [transition-delay:950ms] pointer-events-auto',
            )}
        >
            {currentGarden && raisedBed && (
                <div className="absolute max-w-64 md:max-w-[312px] top-[calc(50%-203.5px)] left-[calc(50%-156.5px)]">
                    <Modal
                        title="Informacije o gredici"
                        modal={false}
                        className="md:border-tertiary md:border-b-4"
                        trigger={
                            <ButtonGreen fullWidth>
                                <Row spacing={1}>
                                    <div
                                        className="relative h-6 min-w-4"
                                        title="Identifikator gredice"
                                    >
                                        <span className="absolute -top-2 left-1/2 -translate-x-1/2 font-bold">
                                            {raisedBed.physicalId}
                                        </span>
                                        <RaisedBedIcon className="absolute top-1 left-1/2 -translate-x-1/2 size-6" />
                                    </div>
                                    <Typography semiBold noWrap>
                                        {raisedBed?.name}
                                    </Typography>
                                </Row>
                            </ButtonGreen>
                        }
                    >
                        <RaisedBedInfo
                            gardenId={currentGarden.id}
                            raisedBed={raisedBed}
                        />
                    </Modal>
                </div>
            )}
            <div className="absolute top-[calc(50%-3px)] left-1/2 size-[316px] -translate-x-1/2 -translate-y-1/2">
                {view === 'closeup' && currentGarden && raisedBed && (
                    <RaisedBedField
                        gardenId={currentGarden.id}
                        raisedBedId={raisedBed.id}
                    />
                )}
            </div>
            {currentGarden && raisedBed && (
                <>
                    <div className="absolute top-[calc(50%+160px)] left-[calc(50%-156.5px)] md:left-[calc(50%+210px)] md:top-[calc(50%+74px)]">
                        <Stack spacing={0.5}>
                            <RaisedBedWatering
                                gardenId={currentGarden.id}
                                raisedBedId={raisedBed.id}
                            />
                            <RaisedBedSensorInfo
                                gardenId={currentGarden.id}
                                raisedBedId={raisedBed.id}
                            />
                        </Stack>
                    </div>
                    <div className="absolute top-[calc(50%+160px)] left-[calc(50%+36px)] md:top-[calc(50%-158px)] md:left-[calc(50%+210px)]">
                        <RaisedBedFieldSuggestions
                            gardenId={currentGarden.id}
                            raisedBedId={raisedBed.id}
                        />
                    </div>
                </>
            )}
            <ButtonGreen
                variant="plain"
                className={cx(
                    'absolute top-[calc(50%-203.5px)] md:left-[calc(50%+210px)] md:size-auto',
                    'rounded-full size-10 left-[calc(50%+118px)]',
                )}
                onClick={() => {
                    setView({ view: 'normal' });
                }}
                startDecorator={<Check className="size-5 shrink-0" />}
            >
                <span className="hidden md:block">Završi uređivanje</span>
            </ButtonGreen>
        </div>
    );
}
