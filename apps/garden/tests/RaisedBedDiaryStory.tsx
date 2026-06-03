import * as ReactQuery from '@tanstack/react-query';
import { type PropsWithChildren, useMemo } from 'react';
import { GameFlagsContext } from '../../../packages/game/src/GameFlagsContext';
import { RaisedBedDiary } from '../../../packages/game/src/hud/raisedBed/RaisedBedDiary';
import { Card, CardOverflow } from '../../../packages/ui/src/Card';

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
        name: 'AI analysis with several images',
        description:
            '## Analysis\n\nThe gallery and text should stay constrained inside the diary row.',
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

    return queryClient;
}

function RaisedBedDiaryTestProviders({ children }: PropsWithChildren) {
    const queryClient = useMemo(() => createRaisedBedDiaryQueryClient(), []);

    return (
        <ReactQuery.QueryClientProvider client={queryClient}>
            <GameFlagsContext.Provider value={{ raisedBedImageAI: false }}>
                {children}
            </GameFlagsContext.Provider>
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
