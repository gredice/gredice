import { SunflowerPackageCard } from '@packages/game/shared-ui/sunflowers/SunflowerPackageCard';
import { sunflowerVisualPackages } from './sunflowerEconomyFixtures';

export function SunflowerPackageExamples() {
    return (
        <section
            aria-label="Paketi suncokreta"
            className="@container/sunflower-packages space-y-4"
        >
            <h2 className="text-xl font-semibold">Paketi suncokreta</h2>
            <div className="grid grid-cols-1 gap-3 @[36rem]/sunflower-packages:grid-cols-2 @[50rem]/sunflower-packages:grid-cols-3">
                {sunflowerVisualPackages.map((pkg) => (
                    <SunflowerPackageCard
                        key={pkg.code}
                        pkg={pkg}
                        onSelect={() => undefined}
                    />
                ))}
            </div>
        </section>
    );
}
