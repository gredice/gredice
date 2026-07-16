import * as ReactQuery from '@tanstack/react-query';
import { type PropsWithChildren, useMemo } from 'react';
import { GameAnalyticsProvider } from '../../../packages/game/src/analytics/GameAnalyticsContext';
import type { PushSetupStatus } from '../../../packages/game/src/hooks/usePushPermissionOnboarding';
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
    premiumNotificationControlsEnabled,
    pushSetupStatus = 'subscribed',
    pushSubscriptionChecked = true,
}: {
    initialFilter?: NotificationsFilter;
    premiumNotificationControlsEnabled?: boolean;
    pushSetupStatus?: PushSetupStatus;
    pushSubscriptionChecked?: boolean;
}) {
    return (
        <Providers>
            <div className="w-[520px] p-4">
                <NotificationsTab
                    initialFilter={initialFilter}
                    premiumNotificationControlsEnabled={
                        premiumNotificationControlsEnabled
                    }
                    pushSetupState={{
                        status: pushSetupStatus,
                        subscriptionChecked: pushSubscriptionChecked,
                    }}
                />
            </div>
        </Providers>
    );
}
