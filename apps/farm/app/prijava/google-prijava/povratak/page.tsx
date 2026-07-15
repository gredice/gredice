import { Suspense } from 'react';
import { OAuthCallbackPanel } from '../../OAuthCallbackPanel';
import { UrlAuthForward } from '../../UrlAuthForward';

export default function GoogleCallbackPage() {
    return (
        <Suspense
            fallback={
                <OAuthCallbackPanel
                    provider="google"
                    state={{ status: 'processing' }}
                />
            }
        >
            <UrlAuthForward provider="google" />
        </Suspense>
    );
}
