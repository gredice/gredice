import { PlantsViewTabs } from '@apps/www/app/biljke/PlantsViewTabs';
import { Tabs } from '@gredice/ui/Tabs';
import { plantArchiveStoryFilters } from './plantArchiveStoryData';

export function StyledPlantTabsExample() {
    return (
        <section aria-label="Consistent plant tabs" className="space-y-4">
            <h2 className="text-xl font-semibold">
                Dosljedne ikone na karticama
            </h2>
            <div className="flex flex-wrap gap-6">
                {['popis', 'kalendar'].map((view) => (
                    <Tabs key={view} value={view}>
                        <PlantsViewTabs
                            filters={plantArchiveStoryFilters(11)}
                        />
                    </Tabs>
                ))}
            </div>
        </section>
    );
}
