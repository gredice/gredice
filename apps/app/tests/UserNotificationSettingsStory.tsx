import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { UserNotificationSettings } from '../app/admin/settings/_components/UserNotificationSettings';

export function UserNotificationSettingsStory() {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: { queries: { retry: false } },
            }),
    );

    return (
        <QueryClientProvider client={queryClient}>
            <div className="@container/settings max-w-4xl space-y-4 p-4">
                <UserNotificationSettings />
            </div>
        </QueryClientProvider>
    );
}
