import * as ReactQuery from '@tanstack/react-query';
import { type PropsWithChildren, useMemo } from 'react';
import { GameAnalyticsProvider } from '../../../packages/game/src/analytics/GameAnalyticsContext';
import { NotificationsTab } from '../../../packages/game/src/modals/components/NotificationsTab';
import type { NotificationsFilter } from '../../../packages/game/src/notificationFilters';

const currentUser = {
    avatarUrl: null,
    birthday: null,
    birthdayLastRewardAt: null,
    birthdayLastUpdatedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    displayName: 'Test User',
    email: 'test@example.com',
    id: 'test-user',
    userName: 'test-user',
};

function createQueryClient() {
    const queryClient = new ReactQuery.QueryClient({
        defaultOptions: {
            mutations: { retry: false },
            queries: { retry: false },
        },
    });

    queryClient.setQueryData(['currentUser'], currentUser);
    queryClient.setQueryData(['notifications'], []);

    return queryClient;
}

function Providers({ children }: PropsWithChildren) {
    const queryClient = useMemo(() => createQueryClient(), []);

    return (
        <ReactQuery.QueryClientProvider client={queryClient}>
            <GameAnalyticsProvider capture={() => undefined}>
                {children}
            </GameAnalyticsProvider>
        </ReactQuery.QueryClientProvider>
    );
}

export function NotificationsTabStory({
    initialFilter,
}: {
    initialFilter?: NotificationsFilter;
}) {
    return (
        <Providers>
            <div className="w-[520px] p-4">
                <NotificationsTab initialFilter={initialFilter} />
            </div>
        </Providers>
    );
}
