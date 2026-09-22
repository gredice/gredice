import { Button } from '@gredice/ui/Button';
import { useState } from 'react';
import { OperationScheduleModal } from '../../../packages/game/src/hud/raisedBed/shared/OperationScheduleModal';
import {
    createGameState,
    GameStateContext,
} from '../../../packages/game/src/useGameState';
import { cartOperation } from './GardenOperationsHudStory';

export function OperationRequestNoteStory({
    fail = false,
}: {
    fail?: boolean;
}) {
    const [store] = useState(() =>
        createGameState({
            appBaseUrl: 'http://localhost',
            freezeTime: new Date('2026-09-22T12:00:00.000Z'),
            isMock: true,
            winterMode: 'summer',
        }),
    );
    const [submitted, setSubmitted] = useState('');
    return (
        <GameStateContext.Provider value={store}>
            <OperationScheduleModal
                gardenId={1}
                operation={cartOperation}
                showHistory={false}
                trigger={<Button>Zakaži</Button>}
                onConfirm={async (_date, note) => {
                    if (fail) throw new Error('Request failed');
                    setSubmitted(note ?? '(bez napomene)');
                }}
            />
            <output>{submitted}</output>
        </GameStateContext.Provider>
    );
}
