import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type PropsWithChildren, useMemo, useState } from 'react';
import { NotificationSettings } from './NotificationSettings';
import type { PushSetupResult, PushSetupStatus } from './usePushSubscription';

function createQueryClient() {
    return new QueryClient({
        defaultOptions: {
            mutations: { retry: false },
            queries: { retry: false },
        },
    });
}

function Providers({ children }: PropsWithChildren) {
    const queryClient = useMemo(() => createQueryClient(), []);

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}

function canPrompt(status: PushSetupStatus) {
    return (
        status === 'default' ||
        status === 'granted' ||
        status === 'prompt-dismissed' ||
        status === 'setup-failed'
    );
}

export function NotificationSettingsStory({
    currentDeviceId,
    initialStatus = 'default',
    requestResult = 'subscribed',
}: {
    currentDeviceId?: string;
    initialStatus?: PushSetupStatus;
    requestResult?: PushSetupResult;
}) {
    const [status, setStatus] = useState<PushSetupStatus>(initialStatus);

    return (
        <Providers>
            <div className="w-[720px] p-4">
                <NotificationSettings
                    readCurrentPushDeviceId={() => currentDeviceId}
                    pushOnboarding={{
                        canPrompt: canPrompt(status),
                        dismissPrompt: () => setStatus('prompt-dismissed'),
                        error:
                            status === 'setup-failed'
                                ? 'Obavijesti nisu uključene. Pokušaj ponovno.'
                                : null,
                        isRequesting: false,
                        requestPermission: async () => {
                            const requestCount = Number.parseInt(
                                window.localStorage.getItem(
                                    'farm:test:push-request-count',
                                ) ?? '0',
                                10,
                            );
                            window.localStorage.setItem(
                                'farm:test:push-request-count',
                                String(requestCount + 1),
                            );
                            if (requestResult === 'default') {
                                setStatus('prompt-dismissed');
                                return 'prompt-dismissed';
                            }
                            setStatus(requestResult);
                            return requestResult;
                        },
                        revokeBrowserSubscription: async () => {
                            window.localStorage.setItem(
                                'farm:test:browser-subscription-revoked',
                                '1',
                            );
                            return true;
                        },
                        status,
                    }}
                />
            </div>
        </Providers>
    );
}
