import * as ReactQuery from '@tanstack/react-query';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { useEffect, useMemo, useState } from 'react';
import { GameAnalyticsProvider } from '../../../packages/game/src/analytics/GameAnalyticsContext';
import {
    type TutorialChecklistGroup,
    type TutorialChecklistState,
    type TutorialChecklistTask,
    tutorialChecklistKeys,
} from '../../../packages/game/src/hooks/useTutorialChecklist';
import { TutorialChecklistHud } from '../../../packages/game/src/hud/TutorialChecklistHud';
import {
    createGameState,
    GameStateContext,
} from '../../../packages/game/src/useGameState';

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

function settleTask(task: TutorialChecklistTask): TutorialChecklistTask {
    return {
        ...task,
        claimable: false,
        claimedAt: '2026-06-12T08:00:00.000Z',
        completed: true,
        status: task.rewardSunflowers > 0 ? 'claimed' : 'completed',
    };
}

function settleGroup(group: TutorialChecklistGroup): TutorialChecklistGroup {
    const tasks = group.tasks.map(settleTask);

    return {
        ...group,
        claimableCount: 0,
        completedCount: tasks.length,
        tasks,
        totalCount: tasks.length,
    };
}

function getTotals(
    groups: TutorialChecklistGroup[],
): TutorialChecklistState['totals'] {
    const tasks = groups.flatMap((group) => group.tasks);

    return {
        availableSunflowers: tasks
            .filter((task) => task.claimable)
            .reduce((total, task) => total + task.rewardSunflowers, 0),
        claimableCount: tasks.filter((task) => task.claimable).length,
        completedCount: tasks.filter((task) => task.completed).length,
        earnedSunflowers: tasks
            .filter((task) => task.completed)
            .reduce((total, task) => total + task.rewardSunflowers, 0),
        totalCount: tasks.length,
    };
}

const completedGroups = checklistState.groups.map(settleGroup);

const completedChecklistState: TutorialChecklistState = {
    groups: completedGroups,
    totals: getTotals(completedGroups),
};

const completedGroupsWithNewTask = completedChecklistState.groups.map(
    (group) => {
        if (group.id !== 'day-2') {
            return group;
        }

        return settleGroup({
            ...group,
            tasks: [
                ...group.tasks,
                createTask({
                    completed: true,
                    groupId: 'day-2',
                    index: 3,
                    title: 'Novi zadatak',
                }),
            ],
        });
    },
);

const completedChecklistStateWithNewTask: TutorialChecklistState = {
    groups: completedGroupsWithNewTask,
    totals: getTotals(completedGroupsWithNewTask),
};

function createTutorialChecklistQueryClient(state: TutorialChecklistState) {
    const queryClient = new ReactQuery.QueryClient({
        defaultOptions: {
            queries: { retry: false, staleTime: Infinity },
        },
    });

    queryClient.setQueryData(tutorialChecklistKeys, state);

    return queryClient;
}

type TutorialChecklistHudStoryVariant =
    | 'completed'
    | 'completed-with-new-task'
    | 'default';

function stateForVariant(
    variant: TutorialChecklistHudStoryVariant,
): TutorialChecklistState {
    if (variant === 'completed') {
        return completedChecklistState;
    }

    if (variant === 'completed-with-new-task') {
        return completedChecklistStateWithNewTask;
    }

    return checklistState;
}

export function TutorialChecklistHudStory({
    variant = 'default',
}: {
    variant?: TutorialChecklistHudStoryVariant;
}) {
    const state = stateForVariant(variant);
    const [queryClient] = useState(() =>
        createTutorialChecklistQueryClient(state),
    );
    const gameStore = useMemo(
        () =>
            createGameState({
                appBaseUrl: 'http://localhost',
                freezeTime: new Date('2026-05-13T12:00:00.000Z'),
                isMock: true,
                winterMode: 'summer',
            }),
        [],
    );

    useEffect(() => {
        queryClient.setQueryData(tutorialChecklistKeys, state);
    }, [queryClient, state]);

    return (
        <NuqsTestingAdapter>
            <ReactQuery.QueryClientProvider client={queryClient}>
                <GameStateContext.Provider value={gameStore}>
                    <GameAnalyticsProvider capture={() => undefined}>
                        <div className="min-h-48 bg-green-950/20 p-8">
                            <TutorialChecklistHud />
                        </div>
                    </GameAnalyticsProvider>
                </GameStateContext.Provider>
            </ReactQuery.QueryClientProvider>
        </NuqsTestingAdapter>
    );
}
