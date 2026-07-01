import { Check, Navigate } from '@gredice/ui/icons';
import { RaisedBedIcon } from '@gredice/ui/RaisedBedIcon';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { useState } from 'react';
import { useGameAnalytics } from '../analytics/GameAnalyticsContext';
import {
    useCurrentGarden,
    useIsSandboxGarden,
} from '../hooks/useCurrentGarden';
import { isRaisedBedAbandoned } from '../raisedBedConstants';
import { ButtonGreen } from '../shared-ui/ButtonGreen';
import { GameModal } from '../shared-ui/game-modal';
import { useGameState } from '../useGameState';
import { useRemoveRaisedBedCloseupParam } from '../useRaisedBedCloseup';
import {
    findRaisedBedByBlockId,
    getRaisedBedBlockIds,
} from '../utils/raisedBedBlocks';
import styles from './RaisedBedFieldHud.module.css';
import { RaisedBedField } from './raisedBed/RaisedBedField';
import { RaisedBedFieldSuggestions } from './raisedBed/RaisedBedFieldSuggestions';
import { RaisedBedGreenhouseSuggestion } from './raisedBed/RaisedBedGreenhouseSuggestion';
import { RaisedBedInfo } from './raisedBed/RaisedBedInfo';
import { RaisedBedPhotosModal } from './raisedBed/RaisedBedPhotosModal';
import { RaisedBedSensorInfo } from './raisedBed/RaisedBedSensorInfo';
import { RaisedBedWatering } from './raisedBed/RaisedBedWatering';

export function RaisedBedFieldHud() {
    const { data: currentGarden } = useCurrentGarden();
    const isSandbox = useIsSandboxGarden();
    const { track } = useGameAnalytics();
    const [isInfoOpen, setIsInfoOpen] = useState(false);
    const view = useGameState((state) => state.view);
    const { mutate: removeRaisedBedCloseupParam } =
        useRemoveRaisedBedCloseupParam();
    const closeupBlock = useGameState((state) => state.closeupBlock);
    const raisedBed = closeupBlock
        ? findRaisedBedByBlockId(currentGarden, closeupBlock.id)
        : null;
    const canUseRaisedBedActions = raisedBed
        ? raisedBed.isValid && !isRaisedBedAbandoned(raisedBed.status)
        : false;
    const raisedBedBlockCount =
        currentGarden && raisedBed
            ? getRaisedBedBlockIds(currentGarden, raisedBed.id).length
            : 1;
    const isDoubleRaisedBed = raisedBedBlockCount === 2;

    return (
        <div
            className={cx(
                styles.root,
                isDoubleRaisedBed && styles.doubleRaisedBed,
                'opacity-0 transition-opacity pointer-events-none duration-300',
                view === 'closeup' &&
                    'opacity-100 [transition-delay:950ms] pointer-events-auto',
            )}
            data-raised-bed-closeup-hud
        >
            {currentGarden && raisedBed && (
                <div
                    className="absolute z-40 top-[var(--raised-bed-ui-top)] left-[var(--raised-bed-title-left)]"
                    data-raised-bed-title
                >
                    <div className="relative flex items-center">
                        {!isSandbox && (
                            <div className="absolute right-full top-1/2 mr-2 -translate-y-1/2">
                                <RaisedBedPhotosModal
                                    gardenId={currentGarden.id}
                                    raisedBedId={raisedBed.id}
                                    subjectName={raisedBed.name}
                                    triggerPlacement="hud"
                                    hideWhenEmpty
                                />
                            </div>
                        )}
                        <GameModal
                            open={isInfoOpen}
                            onOpenChange={(open) => {
                                if (open) {
                                    track('game_raised_bed_info_opened', {
                                        garden_id: currentGarden.id,
                                        raised_bed_id: raisedBed.id,
                                        raised_bed_name: raisedBed.name,
                                    });
                                }
                                setIsInfoOpen(open);
                            }}
                            title="Informacije o gredici"
                            modal={false}
                            className="overflow-x-hidden"
                            trigger={
                                <ButtonGreen
                                    className="max-w-[var(--raised-bed-title-max-width)] md:max-w-[312px]"
                                    data-raised-bed-details-trigger
                                    endDecorator={
                                        <Navigate className="size-4 shrink-0" />
                                    }
                                >
                                    <Row spacing={2} className="min-w-0">
                                        <RaisedBedIcon
                                            physicalId={raisedBed.physicalId}
                                            className="size-6 shrink-0"
                                        />
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
                        </GameModal>
                    </div>
                </div>
            )}
            <div
                className="absolute z-0 top-[calc(50%-1px)] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[var(--raised-bed-grid-size)] h-[var(--raised-bed-grid-height)]"
                data-raised-bed-grid
            >
                {view === 'closeup' && currentGarden && raisedBed && (
                    <RaisedBedField
                        gardenId={currentGarden.id}
                        raisedBedId={raisedBed.id}
                    />
                )}
            </div>
            <Stack
                className="absolute z-40 md:left-[var(--raised-bed-side-panel-left)] top-[var(--raised-bed-ui-top-mobile)] md:top-[var(--raised-bed-ui-top)] left-[var(--raised-bed-close-button-left)]"
                spacing={2}
                alignItems="center"
                data-raised-bed-action-rail
                style={{ gap: 'var(--raised-bed-action-gap)' }}
            >
                <ButtonGreen
                    variant="plain"
                    className="rounded-full size-10 max-[390px]:size-9 md:size-auto"
                    onClick={() => {
                        track('game_raised_bed_closed', {
                            garden_id: currentGarden?.id,
                            raised_bed_id: raisedBed?.id,
                            raised_bed_name: raisedBed?.name,
                        });
                        removeRaisedBedCloseupParam();
                    }}
                    startDecorator={<Check className="size-5 shrink-0" />}
                    fullWidth
                >
                    <span className="hidden md:block">Završi uređivanje</span>
                </ButtonGreen>
                {currentGarden &&
                    raisedBed &&
                    canUseRaisedBedActions &&
                    !isSandbox && (
                        <>
                            <RaisedBedFieldSuggestions
                                gardenId={currentGarden.id}
                                raisedBedId={raisedBed.id}
                            />
                            <RaisedBedGreenhouseSuggestion
                                gardenId={currentGarden.id}
                                raisedBedId={raisedBed.id}
                            />
                            <RaisedBedWatering
                                gardenId={currentGarden.id}
                                raisedBedId={raisedBed.id}
                            />
                            <RaisedBedSensorInfo
                                gardenId={currentGarden.id}
                                raisedBedId={raisedBed.id}
                            />
                        </>
                    )}
            </Stack>
        </div>
    );
}
