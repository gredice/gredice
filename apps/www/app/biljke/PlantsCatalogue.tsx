'use client';

import { TabsContent } from '@gredice/ui/Tabs';
import { Card, CardOverflow } from '../../components/shared/Card';
import { PlantsCalendar } from './PlantsCalendar';
import { PlantsGallery } from './PlantsGallery';
import type { PlantCatalogueItem } from './plantCatalogue';
import type { PlantArchiveFilterDefaults } from './usePlantArchiveFilters';

export function PlantsCatalogue(props: {
    filters: PlantArchiveFilterDefaults;
    plants: PlantCatalogueItem[];
}) {
    return (
        <>
            <TabsContent value="popis" className="mt-2">
                <PlantsGallery {...props} />
            </TabsContent>
            <TabsContent value="kalendar" className="mt-2">
                <Card>
                    <CardOverflow>
                        <PlantsCalendar {...props} />
                    </CardOverflow>
                </Card>
            </TabsContent>
        </>
    );
}
