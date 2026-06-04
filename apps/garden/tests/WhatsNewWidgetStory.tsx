import * as ReactQuery from '@tanstack/react-query';
import { type PropsWithChildren, useMemo } from 'react';
import { GameAnalyticsProvider } from '../../../packages/game/src/analytics/GameAnalyticsContext';
import { WhatsNewWidget } from '../../../packages/game/src/hud/WhatsNewWidget';

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
    whatsNewLastSeenAt: null,
    whatsNewPopupDisabled: false,
};

function createQueryClient() {
    const queryClient = new ReactQuery.QueryClient({
        defaultOptions: {
            mutations: { retry: false },
            queries: { retry: false },
        },
    });

    queryClient.setQueryData(['currentUser'], currentUser);

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

export function WhatsNewWidgetStory() {
    return (
        <Providers>
            <div className="relative h-[420px] w-[640px] bg-background">
                <WhatsNewWidget enabled />
            </div>
        </Providers>
    );
}
