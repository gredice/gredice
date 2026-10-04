import { cx } from '@gredice/ui/utils';
import { PublicCatalogVisualExamples } from './PublicCatalogVisualExamples';

export function PublicCatalogVisualsShowcase({
    dark = false,
}: {
    dark?: boolean;
}) {
    return (
        <main
            className={cx(
                'min-h-screen bg-background p-4 text-foreground sm:p-6',
                dark && 'dark',
            )}
        >
            <div className="mx-auto max-w-6xl space-y-8">
                <h1 className="text-2xl font-semibold">
                    Public catalog artwork
                </h1>
                <PublicCatalogVisualExamples />
            </div>
        </main>
    );
}
