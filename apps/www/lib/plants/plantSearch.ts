import { normalizeSearchText } from '../search/normalizeSearchText';

export type PlantSearchable = {
    information: {
        name?: string | null;
        label?: string | null;
        alternativeName?: string[] | null;
    };
};

export function plantMatchesSearch(
    plant: PlantSearchable,
    normalizedSearch: string,
) {
    if (!normalizedSearch) {
        return true;
    }

    return [
        plant.information.name,
        plant.information.label,
        ...(plant.information.alternativeName ?? []),
    ].some((value) => normalizeSearchText(value).includes(normalizedSearch));
}

export function matchingPlantAlternativeName(
    plant: PlantSearchable,
    normalizedSearch: string,
) {
    if (!normalizedSearch) {
        return undefined;
    }

    return plant.information.alternativeName?.find((name) =>
        normalizeSearchText(name).includes(normalizedSearch),
    );
}
