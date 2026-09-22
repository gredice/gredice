import {
    type AchievementActivity,
    type AchievementRecord,
    getAchievementDefinitions,
} from '@gredice/js/achievements';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { accountAchievementsKeys } from '../../hooks/useAccountAchievements';
import { AchievementsTab } from '../../modals/components/AchievementsTab';
import { AchievementsOverview } from './AchievementsOverview';

export type CollectionState =
    | 'empty'
    | 'starter'
    | 'experienced'
    | 'complete'
    | 'progress';
function recordsFor(state: CollectionState): AchievementRecord[] {
    if (state === 'empty') return [];
    return getAchievementDefinitions()
        .filter(
            (award) =>
                state === 'complete' ||
                (state === 'starter'
                    ? award.level === 1
                    : award.level <= (state === 'progress' ? 4 : 6)),
        )
        .map((award) => {
            const status: AchievementRecord['status'] =
                state === 'experienced' && award.level === 6
                    ? 'denied'
                    : state === 'experienced' && award.level === 5
                      ? 'pending'
                      : 'approved';
            return {
                key: award.key,
                status,
                earnedAt: '2026-09-10T12:00:00.000Z',
                rewardSunflowers:
                    award.key === 'watering_20' ? 0 : award.rewardSunflowers,
                approvedAt:
                    status === 'approved' ? '2026-09-11T10:00:00.000Z' : null,
                rewardGrantedAt:
                    status === 'approved' && award.familyKey !== 'watering'
                        ? '2026-09-11T12:00:00.000Z'
                        : null,
            };
        });
}
function responseFor(
    state: CollectionState,
    accountId = 'award-fixture-account',
    activity?: AchievementActivity | null,
) {
    return {
        accountId,
        achievements: recordsFor(state),
        activity:
            activity === null
                ? undefined
                : (activity ?? {
                      calculatedAt: '2026-09-22T08:00:00.000Z',
                      counts:
                          state === 'empty'
                              ? {
                                    planting: 0,
                                    watering: 0,
                                    harvest: 0,
                                    community_editing: 0,
                                    garden_diversity: 0,
                                    seed_to_table: 0,
                                }
                              : {
                                    planting: 78,
                                    watering: 78,
                                    harvest: 78,
                                    community_editing: 32,
                                    garden_diversity: 17,
                                    seed_to_table: 27,
                                },
                  }),
    };
}
export function AchievementCollectionShowcase({
    state = 'experienced',
    dark = false,
    allowAccountReset = false,
    allowApproval = false,
    unseeded = false,
    accountUnseeded = false,
    activity,
    showGuide = false,
}: {
    state?: CollectionState;
    dark?: boolean;
    allowAccountReset?: boolean;
    allowApproval?: boolean;
    unseeded?: boolean;
    accountUnseeded?: boolean;
    activity?: AchievementActivity | null;
    showGuide?: boolean;
}) {
    useEffect(() => {
        if (!dark) return;
        const root = document.documentElement;
        const alreadyDark = root.classList.contains('dark');
        root.classList.add('dark');
        return () => {
            if (!alreadyDark) root.classList.remove('dark');
        };
    }, [dark]);
    const [queryClient] = useState(() => {
        const client = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        });
        if (accountUnseeded) return client;
        client.setQueryData(['accounts', 'current'], {
            id: 'award-fixture-account',
        });
        if (!unseeded)
            client.setQueryData(
                [...accountAchievementsKeys, 'award-fixture-account'],
                responseFor(state, 'award-fixture-account', activity),
            );
        return client;
    });
    return (
        <QueryClientProvider client={queryClient}>
            <div
                className={`${dark ? 'dark' : ''} min-h-screen bg-background p-4 text-foreground`}
            >
                <section
                    className="mx-auto max-w-xl space-y-4"
                    aria-label="Zbirka postignuća"
                >
                    <h1 className="text-xl font-semibold">Tvoja postignuća</h1>
                    <p className="text-sm text-foreground/75">
                        Svaka nova razina donosi posebnu nagradu za tvoju
                        zbirku.
                    </p>
                    {showGuide ? <AchievementsTab /> : <AchievementsOverview />}
                    {allowApproval && (
                        <button
                            type="button"
                            onClick={() =>
                                queryClient.setQueryData(
                                    [
                                        ...accountAchievementsKeys,
                                        'award-fixture-account',
                                    ],
                                    responseFor('complete'),
                                )
                            }
                        >
                            Potvrdi nove razine
                        </button>
                    )}
                    {allowAccountReset && (
                        <button
                            type="button"
                            onClick={() => {
                                queryClient.setQueryData(
                                    ['accounts', 'current'],
                                    { id: 'new-fixture-account' },
                                );
                                queryClient.setQueryData(
                                    [
                                        ...accountAchievementsKeys,
                                        'new-fixture-account',
                                    ],
                                    responseFor('empty', 'new-fixture-account'),
                                );
                            }}
                        >
                            Prikaži novi račun
                        </button>
                    )}
                </section>
            </div>
        </QueryClientProvider>
    );
}
