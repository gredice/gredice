import * as ReactQuery from '@tanstack/react-query';
import { type PropsWithChildren, useMemo } from 'react';
import { queryKey as currentUserQueryKey } from '../../../packages/game/src/hooks/useCurrentUser';
import { UserBirthdayCard } from '../../../packages/game/src/modals/components/UserBirthdayCard';

const currentUser = {
    avatarUrl: null,
    birthday: null,
    birthdayLastRewardAt: null,
    birthdayLastUpdatedAt: null,
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    displayName: 'Aleks Tutorial',
    email: 'aleks.tutorial@example.com',
    id: 'test-user',
    userName: 'aleks.tutorial@example.com',
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

    queryClient.setQueryData(currentUserQueryKey.currentUser, currentUser);

    return queryClient;
}

function Providers({ children }: PropsWithChildren) {
    const queryClient = useMemo(createQueryClient, []);

    return (
        <ReactQuery.QueryClientProvider client={queryClient}>
            {children}
        </ReactQuery.QueryClientProvider>
    );
}

export function UserBirthdayCardStory() {
    return (
        <Providers>
            <div className="w-[600px] p-4" data-testid="birthday-card-frame">
                <UserBirthdayCard />
            </div>
        </Providers>
    );
}
