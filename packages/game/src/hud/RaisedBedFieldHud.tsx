import { Check } from '@signalco/ui-icons';
import { cx } from '@signalco/ui-primitives/cx';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { CSSProperties } from 'react';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import { ButtonGreen } from '../shared-ui/ButtonGreen';
import { useGameState } from '../useGameState';
import { useRemoveRaisedBedCloseupParam } from '../useRaisedBedCloseup';
import {
    findRaisedBedByBlockId,
    getRaisedBedBlockIds,
} from '../utils/raisedBedBlocks';
import { RaisedBedIdentifierIcon } from './components/RaisedBedIdentifierIcon';
import { RaisedBedField } from './raisedBed/RaisedBedField';
import { RaisedBedFieldSuggestions } from './raisedBed/RaisedBedFieldSuggestions';
import { RaisedBedGreenhouseSuggestion } from './raisedBed/RaisedBedGreenhouseSuggestion';
import { RaisedBedInfo } from './raisedBed/RaisedBedInfo';
import { RaisedBedSensorInfo } from './raisedBed/RaisedBedSensorInfo';
import { RaisedBedWatering } from './raisedBed/RaisedBedWatering';

const GRID_SIZE = 240;
const GRID_HEIGHT_ADDITIONAL = 30;
const BUTTON_HEIGHT = 40;
const GRID_TOP_ANCHOR_OFFSET = 10;
const SIDE_PANEL_MD_LEFT_OFFSET = GRID_SIZE / 2 + 4;
const MOBILE_CLOSE_BUTTON_LEFT_OFFSET = GRID_SIZE / 2;
const RIGHT_ACTIONS_TOP_INSET = 46;
const SUGGESTIONS_LEFT_OFFSET = GRID_SIZE / 2 + 4;

function centerOffset(offset: number) {
    const operator = offset >= 0 ? '+' : '-';
    return `calc(50% ${operator} ${Math.abs(offset)}px)`;
}

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
    const { mutate: removeRaisedBedCloseupParam } =
        useRemoveRaisedBedCloseupParam();
    const closeupBlock = useGameState((state) => state.closeupBlock);
    const raisedBed = closeupBlock
        ? findRaisedBedByBlockId(currentGarden, closeupBlock.id)
        : null;
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
        '--raised-bed-title-left': centerOffset(-(GRID_SIZE / 2)),
        '--raised-bed-close-button-left': centerOffset(
            MOBILE_CLOSE_BUTTON_LEFT_OFFSET,
        ),
        '--raised-bed-suggestions-top': centerOffset(
            uiTopAnchor + RIGHT_ACTIONS_TOP_INSET,
        ),
        '--raised-bed-suggestions-left': centerOffset(SUGGESTIONS_LEFT_OFFSET),
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
                <div className="absolute max-w-64 md:max-w-[312px] top-[var(--raised-bed-ui-top)] left-[var(--raised-bed-title-left)]">
                    <Modal
                        title="Informacije o gredici"
                        modal={false}
                        className="md:border-tertiary md:border-b-4"
                        trigger={
                            <ButtonGreen fullWidth>
                                <Row spacing={1}>
                                    <RaisedBedIdentifierIcon
                                        physicalId={raisedBed.physicalId}
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
            )}
            <div className="absolute top-[calc(50%-1px)] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[var(--raised-bed-grid-size)] h-[var(--raised-bed-grid-height)]">
                {view === 'closeup' && currentGarden && raisedBed && (
                    <RaisedBedField
                        gardenId={currentGarden.id}
                        raisedBedId={raisedBed.id}
                    />
                )}
            </div>
            <ButtonGreen
                variant="plain"
                className={cx(
                    'absolute md:left-[calc(50%+var(--raised-bed-side-panel-left))] md:size-auto',
                    'rounded-full size-10 top-[var(--raised-bed-ui-top)] left-[var(--raised-bed-close-button-left)]',
                )}
                onClick={removeRaisedBedCloseupParam}
                startDecorator={<Check className="size-5 shrink-0" />}
            >
                <span className="hidden md:block">Završi uređivanje</span>
            </ButtonGreen>
            {currentGarden && raisedBed && raisedBed.isValid && (
                <Stack
                    className="absolute md:left-[calc(50%+var(--raised-bed-side-panel-left))] top-[var(--raised-bed-suggestions-top)] left-[var(--raised-bed-suggestions-left)]"
                    spacing={0.5}
                >
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
                </Stack>
            )}
        </div>
    );
}
