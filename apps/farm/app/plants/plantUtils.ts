import { slugify } from '@gredice/js/slug';
import type { EntityStandardized } from '@gredice/storage';

export function getPlantSortLabel(plantSort: EntityStandardized) {
    return (
        plantSort.information?.label ??
        plantSort.information?.name ??
        `Sorta #${plantSort.id}`
    );
}

export function getPlantSortPlant(plantSort: EntityStandardized) {
    return plantSort.information?.plant ?? null;
}

export function getPlantSortPublicUrl(plantSort: EntityStandardized) {
    const plantName = getPlantSortPlant(plantSort)?.information?.name;
    const sortName = plantSort.information?.name;

    if (!plantName || !sortName) {
        return null;
    }

    return `https://www.gredice.com/biljke/${slugify(plantName)}/sorte/${slugify(sortName)}`;
}

export function normalizePlantSearchText(value: string | null | undefined) {
    return (value ?? '')
        .replace(/[Đđ]/g, 'd')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('hr-HR')
        .trim();
}

export function getPlantSortSearchText(plantSort: EntityStandardized) {
    const plantInformation = getPlantSortPlant(plantSort)?.information;

    return [
        plantSort.information?.label,
        plantSort.information?.name,
        plantSort.information?.shortDescription,
        plantSort.information?.description,
        ...(plantSort.information?.alternativeName ?? []),
        plantInformation?.label,
        plantInformation?.name,
        plantInformation?.shortDescription,
        plantInformation?.description,
        ...(plantInformation?.alternativeName ?? []),
    ]
        .filter((value) => typeof value === 'string')
        .map((value) => normalizePlantSearchText(value))
        .join(' ');
}
