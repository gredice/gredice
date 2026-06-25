import { Check, Navigate } from '@gredice/ui/icons';
import { Modal } from '@gredice/ui/Modal';
import { RaisedBedIcon } from '@gredice/ui/RaisedBedIcon';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { type CSSProperties, useState } from 'react';
import { useGameAnalytics } from '../analytics/GameAnalyticsContext';
import {
    useCurrentGarden,
    useIsSandboxGarden,
} from '../hooks/useCurrentGarden';
import { isRaisedBedAbandoned } from '../raisedBedConstants';
import { ButtonGreen } from '../shared-ui/ButtonGreen';
import { useGameState } from '../useGameState';
import { useRemoveRaisedBedCloseupParam } from '../useRaisedBedCloseup';
import {
    findRaisedBedByBlockId,
    getRaisedBedBlockIds,
} from '../utils/raisedBedBlocks';
import { RaisedBedField } from './raisedBed/RaisedBedField';
import { RaisedBedFieldSuggestions } from './raisedBed/RaisedBedFieldSuggestions';
import { RaisedBedGreenhouseSuggestion } from './raisedBed/RaisedBedGreenhouseSuggestion';
import { RaisedBedInfo } from './raisedBed/RaisedBedInfo';
import { RaisedBedPhotosModal } from './raisedBed/RaisedBedPhotosModal';
import { RaisedBedSensorInfo } from './raisedBed/RaisedBedSensorInfo';
import { RaisedBedWatering } from './raisedBed/RaisedBedWatering';

const GRID_SIZE = 240;
const GRID_HEIGHT_ADDITIONAL = 30;
const BUTTON_HEIGHT = 40;
const GRID_TOP_ANCHOR_OFFSET = 10;
const SIDE_PANEL_MD_LEFT_OFFSET = GRID_SIZE / 2 + 4;
const MOBILE_CLOSE_BUTTON_LEFT_OFFSET = GRID_SIZE / 2 + 2;

function centerOffset(offset: number) {
    const operator = offset >= 0 ? '+' : '-';
    return `calc(50% ${operator} ${Math.abs(offset)}px)`;
}

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
    const gridHeight = isDoubleRaisedBed
        ? GRID_SIZE * 2 + GRID_HEIGHT_ADDITIONAL
        : GRID_SIZE;
    const gridTopOffset = (gridHeight + GRID_HEIGHT_ADDITIONAL) / 2;
    const uiTopAnchor =
        -gridTopOffset - BUTTON_HEIGHT / 2 - GRID_TOP_ANCHOR_OFFSET;
    const hudStyles: CSSProperties & Record<string, string> = {
        '--raised-bed-side-panel-left': `${SIDE_PANEL_MD_LEFT_OFFSET}px`,
        '--raised-bed-ui-top': centerOffset(uiTopAnchor),
        '--raised-bed-ui-top-mobile': `calc(${centerOffset(uiTopAnchor)} + 48px)`,
        '--raised-bed-title-left': centerOffset(-(GRID_SIZE / 2)),
        '--raised-bed-close-button-left': centerOffset(
            MOBILE_CLOSE_BUTTON_LEFT_OFFSET,
        ),
        '--raised-bed-grid-size': `${GRID_SIZE}px`,
        '--raised-bed-grid-height': `${gridHeight}px`,
    };

    return (
        <div
            className={cx(
                'opacity-0 transition-opacity pointer-events-none duration-300',
                view === 'closeup' &&
                    'opacity-100 [transition-delay:950ms] pointer-events-auto',
            )}
            style={hudStyles}
        >
            {currentGarden && raisedBed && (
                <div className="absolute z-40 top-[var(--raised-bed-ui-top)] left-[var(--raised-bed-title-left)]">
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
                        <Modal
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
                            className="overflow-x-hidden md:border-tertiary md:border-b-4"
                            trigger={
                                <ButtonGreen
                                    className="max-w-64 md:max-w-[312px]"
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
                        </Modal>
                    </div>
                </div>
            )}
            <div className="absolute z-0 top-[calc(50%-1px)] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[var(--raised-bed-grid-size)] h-[var(--raised-bed-grid-height)]">
                {view === 'closeup' && currentGarden && raisedBed && (
                    <RaisedBedField
                        gardenId={currentGarden.id}
                        raisedBedId={raisedBed.id}
                    />
                )}
            </div>
            <Stack
                className="absolute z-40 md:left-[calc(50%+var(--raised-bed-side-panel-left))] top-[var(--raised-bed-ui-top-mobile)] md:top-[var(--raised-bed-ui-top)] left-[var(--raised-bed-close-button-left)]"
                spacing={2}
                alignItems="center"
            >
                <ButtonGreen
                    variant="plain"
                    className="rounded-full size-10 md:size-auto"
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
