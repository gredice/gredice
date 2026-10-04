import type { PlantData, PlantSortData } from '@gredice/directory-types';
import { plantMatchesSearch } from '../../lib/plants/plantSearch';
import { normalizeSearchText } from '../../lib/search/normalizeSearchText';

type PlantCardSource = Pick<PlantData, 'id' | 'image' | 'prices'> & {
    information: Pick<PlantData['information'], 'name' | 'alternativeName'> & {
        label?: string;
    };
    attributes?: Pick<
        PlantData['attributes'],
        'seedingDistance' | 'yieldMin' | 'yieldMax' | 'yieldType'
    >;
    isRecommended?: boolean;
};

/** The archive card needs neither descriptions nor related directory entities. */
export function toPlantCard(plant: PlantCardSource) {
    return {
        id: plant.id,
        information: {
            name: plant.information.name,
            label: plant.information.label,
            alternativeName: plant.information.alternativeName,
        },
        image: { cover: { url: plant.image?.cover?.url } },
        attributes: plant.attributes
            ? {
                  seedingDistance: plant.attributes.seedingDistance,
                  yieldMin: plant.attributes.yieldMin,
                  yieldMax: plant.attributes.yieldMax,
                  yieldType: plant.attributes.yieldType,
              }
            : undefined,
        prices: plant.prices ? { perPlant: plant.prices.perPlant } : undefined,
        isRecommended: plant.isRecommended,
    };
}

/** One compact catalogue crosses the server/client boundary for both views. */
export function toPlantCatalogue(
    plants: (PlantCardSource & { calendar: PlantData['calendar'] })[],
    sorts: {
        information: Pick<PlantSortData['information'], 'name'> & {
            plant?: Pick<PlantData, 'id'>;
        };
    }[],
) {
    const sortNames = new Map<number, string[]>();
    for (const sort of sorts) {
        const plantId = sort.information.plant?.id;
        if (plantId && sort.information.name) {
            const names = sortNames.get(plantId) ?? [];
            names.push(sort.information.name);
            sortNames.set(plantId, names);
        }
    }

    const ranges = (value: PlantData['calendar']['sowing'] | undefined) =>
        value?.map(({ start, end }) => ({ start, end }));

    return plants.map((plant) => ({
        ...toPlantCard(plant),
        calendar: {
            propagating: ranges(plant.calendar?.propagating),
            sowing: ranges(plant.calendar?.sowing),
            planting: ranges(plant.calendar?.planting),
            harvest: ranges(plant.calendar?.harvest),
        },
        sortNames: sortNames.get(plant.id) ?? [],
    }));
}

export type PlantCatalogueItem = ReturnType<typeof toPlantCatalogue>[number];

export function matchingCatalogueSortName(
    plant: PlantCatalogueItem,
    normalizedSearch: string,
) {
    return normalizedSearch
        ? plant.sortNames.find((name) =>
              normalizeSearchText(name).includes(normalizedSearch),
          )
        : undefined;
}

export function cataloguePlantMatchesSearch(
    plant: PlantCatalogueItem,
    normalizedSearch: string,
) {
    return (
        plantMatchesSearch(plant, normalizedSearch) ||
        Boolean(matchingCatalogueSortName(plant, normalizedSearch))
    );
}
