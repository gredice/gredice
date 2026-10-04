import { cx } from '@gredice/ui/utils';
import { SowingDensityExamples } from './SowingDensityExamples';
import { StyledPlantTabsExample } from './StyledPlantTabsExample';

export function PlantVisualConsistencyShowcase({
    dark = false,
}: {
    dark?: boolean;
}) {
    return (
        <main
            className={cx(
                'min-h-screen bg-background text-foreground',
                dark && 'dark',
            )}
        >
            <div className="mx-auto max-w-6xl space-y-8 p-4 sm:p-6">
                <h1 className="text-2xl font-semibold">
                    Plant tabs and sowing density
                </h1>
                <StyledPlantTabsExample />
                <SowingDensityExamples />
            </div>
        </main>
    );
}
