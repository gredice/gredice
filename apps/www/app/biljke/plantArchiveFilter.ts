import { normalizeSearchText } from '../../lib/search/normalizeSearchText';
import {
    cataloguePlantMatchesSearch,
    compareCataloguePlantNames,
    type PlantCatalogueItem,
} from './plantCatalogue';
import { isPlantInSeason, type PlantSeasonActivity } from './plantSeason';

/**
 * `searched` ignores the month filter so the month chart can show what each
 * month would add; `filtered` is what the list and calendar render.
 */
export function filterPlantArchive(
    plants: readonly PlantCatalogueItem[],
    {
        activity,
        month,
        search,
    }: {
        activity: PlantSeasonActivity;
        month: number | null;
        search: string;
    },
) {
    const normalizedSearch = normalizeSearchText(search);
    const searched = plants
        .filter((plant) => cataloguePlantMatchesSearch(plant, normalizedSearch))
        .sort(compareCataloguePlantNames);
    const filtered = month
        ? searched.filter((plant) => isPlantInSeason(plant, activity, month))
        : searched;

    return { filtered, normalizedSearch, searched };
}
