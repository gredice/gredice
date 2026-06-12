import * as ReactQuery from '@tanstack/react-query';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { useMemo } from 'react';
import { GameAnalyticsProvider } from '../../../packages/game/src/analytics/GameAnalyticsContext';
import {
    type TutorialChecklistGroup,
    type TutorialChecklistState,
    type TutorialChecklistTask,
    tutorialChecklistKeys,
} from '../../../packages/game/src/hooks/useTutorialChecklist';
import { TutorialChecklistHud } from '../../../packages/game/src/hud/TutorialChecklistHud';

function createTask({
    claimable = false,
    claimed,
    completed = false,
    groupId,
    index,
    status,
    title,
}: {
    claimable?: boolean;
    claimed?: boolean;
    completed?: boolean;
    groupId: TutorialChecklistGroup['id'];
    index: number;
    status?: TutorialChecklistTask['status'];
    title?: string;
}): TutorialChecklistTask {
    const isClaimed = claimed ?? completed;
    const taskStatus =
        status ??
        (isClaimed
            ? 'claimed'
            : claimable
              ? 'ready'
              : completed
                ? 'completed'
                : 'available');

    return {
        actionTarget: 'field',
        claimable,
        claimedAt: isClaimed ? '2026-06-12T08:00:00.000Z' : null,
        completed,
        completion: 'manual',
        description: `Test task ${index.toString()}`,
        groupId,
        key: `${groupId}-task-${index.toString()}`,
        rewardSunflowers: 10,
        status: taskStatus,
        title: title ?? `Task ${index.toString()}`,
    };
}

const checklistState: TutorialChecklistState = {
    groups: [
        {
            claimableCount: 1,
            completedCount: 1,
            description: 'Postavi vrt, košaru i osnovne alate.',
            id: 'day-1',
            tasks: [
                createTask({
                    completed: true,
                    groupId: 'day-1',
                    index: 1,
                    title: 'Uredi profil',
                }),
                createTask({
                    claimable: true,
                    claimed: false,
                    groupId: 'day-1',
                    index: 2,
                    title: 'Postavi biljku u gredicu',
                }),
                createTask({
                    groupId: 'day-1',
                    index: 3,
                    title: 'Popuni gredicu s 9 biljaka',
                }),
            ],
            title: 'Dan 1',
            totalCount: 3,
        },
        {
            claimableCount: 0,
            completedCount: 2,
            description: 'Preuzmi nagrade, radnje, prognozu i biljke.',
            id: 'day-2',
            tasks: [
                createTask({
                    completed: true,
                    groupId: 'day-2',
                    index: 1,
                    title: 'Preuzmi dnevnu nagradu',
                }),
                createTask({
                    completed: true,
                    groupId: 'day-2',
                    index: 2,
                    title: 'Provjeri status radnji',
                }),
            ],
            title: 'Dan 2',
            totalCount: 2,
        },
    ],
    totals: {
        availableSunflowers: 10,
        claimableCount: 1,
        completedCount: 3,
        earnedSunflowers: 30,
        totalCount: 5,
    },
};

function createTutorialChecklistQueryClient() {
    const queryClient = new ReactQuery.QueryClient({
        defaultOptions: {
            queries: { retry: false, staleTime: Infinity },
        },
    });

    queryClient.setQueryData(tutorialChecklistKeys, checklistState);

    return queryClient;
}

export function TutorialChecklistHudStory() {
    const queryClient = useMemo(() => createTutorialChecklistQueryClient(), []);

    return (
        <NuqsTestingAdapter>
            <ReactQuery.QueryClientProvider client={queryClient}>
                <GameAnalyticsProvider capture={() => undefined}>
                    <div className="min-h-48 bg-green-950/20 p-8">
                        <TutorialChecklistHud />
                    </div>
                </GameAnalyticsProvider>
            </ReactQuery.QueryClientProvider>
        </NuqsTestingAdapter>
    );
}
