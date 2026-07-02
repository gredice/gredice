import * as ReactQuery from '@tanstack/react-query';
import { type PropsWithChildren, useMemo } from 'react';
import { RaisedBedDiary } from '../../../packages/game/src/hud/raisedBed/RaisedBedDiary';
import {
    createGameState,
    GameStateContext,
} from '../../../packages/game/src/useGameState';
import { Card, CardOverflow } from '../../../packages/ui/src/Card';
import { buildOperation } from './raisedBedFieldHudScenarios';

const TEST_GARDEN_ID = 1;
const TEST_RAISED_BED_ID = 101;

type DiaryEntry = {
    id: number;
    name: string;
    description?: string;
    status: string | null;
    timestamp: Date;
    imageUrls?: string[] | null;
    isMarkdown?: boolean;
    rescheduleTarget?: {
        type: 'operation';
        operationId: number;
        raisedBedId: number;
        raisedBedFieldId: number | null;
        scheduledDate: string;
    };
};

const singleImageUrls = ['/web-app-manifest-192x192.png'];

const imageUrls = [
    '/web-app-manifest-192x192.png',
    '/web-app-manifest-512x512.png',
    '/Screenshot-20250105-vrt-gredice-com.png',
];

const longWord =
    'SuperdugacakNazivDnevnickogUnosaBezRazmakaKojiMoraOstatiUnutarListe';

const baseRaisedBedOperation = buildOperation({
    id: 77,
    name: 'raised-bed-mulching',
    label: 'Malčiranje gredice',
    stageName: 'growth',
    stageLabel: 'Rast',
});

const raisedBedOperation = {
    ...baseRaisedBedOperation,
    attributes: {
        ...baseRaisedBedOperation.attributes,
        application: 'raisedBedFull',
    },
};

const plantFieldOperation = buildOperation({
    id: 88,
    name: 'plant-watering',
    label: 'Zalijevanje biljke',
    stageName: 'growth',
    stageLabel: 'Rast',
});

function todayUtcIso() {
    const today = new Date();
    return new Date(
        Date.UTC(
            today.getUTCFullYear(),
            today.getUTCMonth(),
            today.getUTCDate(),
        ),
    ).toISOString();
}

const diaryEntries: DiaryEntry[] = [
    {
        id: 1,
        name: `${longWord} 1`,
        description: `${longWord} with a long description and enough words to wrap inside a narrow mobile raised bed diary card.`,
        status: 'Planirano',
        timestamp: new Date('2040-01-05T00:00:00.000Z'),
        imageUrls: singleImageUrls,
        rescheduleTarget: {
            type: 'operation',
            operationId: 1,
            raisedBedId: TEST_RAISED_BED_ID,
            raisedBedFieldId: null,
            scheduledDate: '2040-01-05T00:00:00.000Z',
        },
    },
    {
        id: 2,
        name: 'AI analysis with operation links',
        description:
            '## Analysis\n\nSchedule [Malčiranje gredice](https://www.gredice.com/radnje/mock-raised-bed-mulching#raisedBedId=101) for the full bed and [Zalijevanje biljke](https://www.gredice.com/radnje/mock-plant-watering#raisedBedId=101&positionIndex=5) for the stressed plant.',
        status: null,
        timestamp: new Date('2026-05-12T12:00:00.000Z'),
        imageUrls,
        isMarkdown: true,
    },
    {
        id: 3,
        name: 'Watering and checkup',
        description:
            'Shorter entry without images keeps the same row constraints.',
        status: 'Planirano',
        timestamp: new Date(todayUtcIso()),
        rescheduleTarget: {
            type: 'operation',
            operationId: 3,
            raisedBedId: TEST_RAISED_BED_ID,
            raisedBedFieldId: null,
            scheduledDate: todayUtcIso(),
        },
    },
];

function createRaisedBedDiaryQueryClient() {
    const queryClient = new ReactQuery.QueryClient({
        defaultOptions: {
            queries: { retry: false, staleTime: Infinity },
        },
    });

    queryClient.setQueryData(
        ['raisedBeds', TEST_RAISED_BED_ID, 'diary'],
        diaryEntries,
    );
    queryClient.setQueryData(['currentUser'], { id: 'test-user' });
    queryClient.setQueryData(
        ['operations'],
        [raisedBedOperation, plantFieldOperation],
    );
    queryClient.setQueryData(['shopping-cart'], {
        id: 1,
        items: [],
        total: 0,
        totalSunflowers: 0,
        allowPurchase: true,
        notes: [],
    });

    return queryClient;
}

function RaisedBedDiaryTestProviders({ children }: PropsWithChildren) {
    const queryClient = useMemo(() => createRaisedBedDiaryQueryClient(), []);
    const gameStore = useMemo(
        () =>
            createGameState({
                appBaseUrl: 'http://localhost',
                freezeTime: null,
                isMock: false,
                winterMode: 'summer',
            }),
        [],
    );

    return (
        <ReactQuery.QueryClientProvider client={queryClient}>
            <GameStateContext.Provider value={gameStore}>
                {children}
            </GameStateContext.Provider>
        </ReactQuery.QueryClientProvider>
    );
}

export function RaisedBedDiaryOverflowStory() {
    return (
        <RaisedBedDiaryTestProviders>
            <div className="p-4">
                <Card
                    data-testid="diary-shell"
                    className="w-[360px] max-w-full"
                >
                    <CardOverflow className="max-h-96 overflow-y-auto overflow-x-hidden">
                        <RaisedBedDiary
                            gardenId={TEST_GARDEN_ID}
                            raisedBedId={TEST_RAISED_BED_ID}
                        />
                    </CardOverflow>
                </Card>
            </div>
        </RaisedBedDiaryTestProviders>
    );
}
