import * as ReactQuery from '@tanstack/react-query';
import { type PropsWithChildren, useMemo } from 'react';
import { GameAnalyticsProvider } from '../../../packages/game/src/analytics/GameAnalyticsContext';
import { WhatsNewWidget } from '../../../packages/game/src/hud/WhatsNewWidget';

type CurrentUserFixture = {
    avatarUrl: string | null;
    birthday: null;
    birthdayLastRewardAt: Date | null;
    birthdayLastUpdatedAt: Date | null;
    createdAt: Date;
    displayName: string;
    email: string;
    id: string;
    userName: string;
    whatsNewLastSeenAt: Date | null;
    whatsNewPopupDisabled: boolean;
};

const currentUser: CurrentUserFixture = {
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

function createQueryClient(
    currentUserOverride: Partial<CurrentUserFixture> = {},
) {
    const queryClient = new ReactQuery.QueryClient({
        defaultOptions: {
            mutations: { retry: false },
            queries: { retry: false },
        },
    });

    queryClient.setQueryData(['currentUser'], {
        ...currentUser,
        ...currentUserOverride,
    });

    return queryClient;
}

function Providers({
    children,
    currentUserOverride,
}: PropsWithChildren<{
    currentUserOverride?: Partial<CurrentUserFixture>;
}>) {
    const queryClient = useMemo(
        () => createQueryClient(currentUserOverride),
        [currentUserOverride],
    );

    return (
        <ReactQuery.QueryClientProvider client={queryClient}>
            <GameAnalyticsProvider capture={() => undefined}>
                {children}
            </GameAnalyticsProvider>
        </ReactQuery.QueryClientProvider>
    );
}

export function WhatsNewWidgetStory({
    currentUserOverride,
}: {
    currentUserOverride?: Partial<CurrentUserFixture>;
}) {
    return (
        <Providers currentUserOverride={currentUserOverride}>
            <div className="relative h-[420px] w-[640px] bg-background">
                <WhatsNewWidget enabled />
            </div>
        </Providers>
    );
}
