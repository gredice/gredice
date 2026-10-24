import type { PlantCatalogueItem } from '../app/biljke/plantCatalogue';

/** Three copies of every card, calendar row, alternative name and variety. */
export function publicHtmlGrowthFixture(plants: PlantCatalogueItem[]) {
    return Array.from({ length: 3 }, (_, copy) =>
        plants.map((plant) => ({
            ...plant,
            id: plant.id + copy * 1_000_000,
            information: {
                ...plant.information,
                name:
                    copy === 0
                        ? plant.information.name
                        : `${plant.information.name} test ${copy + 1}`,
            },
        })),
    ).flat();
}
