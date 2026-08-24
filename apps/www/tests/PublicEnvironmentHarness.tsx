import {
    PublicChromeProvider,
    PublicEnvironmentFooterControls,
} from '@gredice/ui/PublicChrome';

export function PublicEnvironmentHarness() {
    return (
        <PublicChromeProvider>
            <main className="min-h-dvh py-8">
                <PublicEnvironmentFooterControls />
            </main>
        </PublicChromeProvider>
    );
}
