import { cx } from '@gredice/ui/utils';
import { SunflowerHistoryExamples } from './SunflowerHistoryExamples';
import { SunflowerMascotComparison } from './SunflowerMascotComparison';
import { SunflowerPackageExamples } from './SunflowerPackageExamples';

export function SunflowerEconomyShowcase({
    dark = false,
    compact = false,
}: {
    dark?: boolean;
    compact?: boolean;
}) {
    return (
        <div className={dark ? 'dark' : undefined}>
            <main className="min-h-screen bg-background text-foreground">
                <div
                    className={cx(
                        'mx-auto space-y-8 p-4 sm:p-6',
                        compact ? 'max-w-[400px]' : 'max-w-5xl',
                    )}
                >
                    <h1 className="text-2xl font-semibold">
                        Suncokreti · paketi i aktivnosti
                    </h1>
                    <SunflowerMascotComparison />
                    <SunflowerPackageExamples />
                    <SunflowerHistoryExamples />
                </div>
            </main>
        </div>
    );
}
