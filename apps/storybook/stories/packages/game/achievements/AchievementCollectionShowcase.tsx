import {
    type AchievementRecord,
    getAchievementDefinitions,
} from '@gredice/js/achievements';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { accountAchievementsKeys } from '../../../../../../packages/game/src/hooks/useAccountAchievements';
import { AchievementsOverview } from '../../../../../../packages/game/src/shared-ui/achievements/AchievementsOverview';

export type CollectionState = 'empty' | 'starter' | 'experienced' | 'complete';
function recordsFor(state: CollectionState): AchievementRecord[] {
    if (state === 'empty') return [];
    return getAchievementDefinitions()
        .filter(
            (award) =>
                state === 'complete' ||
                (state === 'starter' ? award.level === 1 : award.level <= 6),
        )
        .map((award) => ({
            key: award.key,
            status:
                state === 'experienced' && award.level === 6
                    ? 'denied'
                    : state === 'experienced' && award.level === 5
                      ? 'pending'
                      : 'approved',
            earnedAt: '2026-09-10T12:00:00.000Z',
            rewardSunflowers:
                award.key === 'watering_20' ? 0 : award.rewardSunflowers,
            approvedAt: '2026-09-11T10:00:00.000Z',
            rewardGrantedAt:
                award.familyKey === 'watering'
                    ? null
                    : '2026-09-11T12:00:00.000Z',
        }));
}
export function AchievementCollectionShowcase({
    state = 'experienced',
    dark = false,
    allowAccountReset = false,
    allowApproval = false,
    unseeded = false,
}: {
    state?: CollectionState;
    dark?: boolean;
    allowAccountReset?: boolean;
    allowApproval?: boolean;
    unseeded?: boolean;
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
        client.setQueryData(['accounts', 'current'], {
            id: 'award-fixture-account',
        });
        if (!unseeded)
            client.setQueryData(accountAchievementsKeys, recordsFor(state));
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
                    <AchievementsOverview />
                    {allowApproval && (
                        <button
                            type="button"
                            onClick={() =>
                                queryClient.setQueryData(
                                    accountAchievementsKeys,
                                    recordsFor('complete'),
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
                                    accountAchievementsKeys,
                                    [],
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
