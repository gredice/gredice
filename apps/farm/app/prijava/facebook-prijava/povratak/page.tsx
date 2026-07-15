import { Suspense } from 'react';
import { OAuthCallbackPanel } from '../../OAuthCallbackPanel';
import { UrlAuthForward } from '../../UrlAuthForward';

export default function FacebookCallbackPage() {
    return (
        <Suspense
            fallback={
                <OAuthCallbackPanel
                    provider="facebook"
                    state={{ status: 'processing' }}
                />
            }
        >
            <UrlAuthForward provider="facebook" />
        </Suspense>
    );
}
