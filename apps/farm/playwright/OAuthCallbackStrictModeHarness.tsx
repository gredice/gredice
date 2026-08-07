import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode, useState } from 'react';
import { OAuthCallbackForwarder } from '../app/prijava/UrlAuthForward';

export function OAuthCallbackStrictModeHarness() {
    const [queryClient] = useState(() => new QueryClient());

    return (
        <StrictMode>
            <QueryClientProvider client={queryClient}>
                <OAuthCallbackForwarder
                    provider="google"
                    returnTo="/notifications"
                    serverErrorCode={null}
                />
            </QueryClientProvider>
        </StrictMode>
    );
}
