import { normalizeSearchText } from '../search/normalizeSearchText';
import type { GardenPet } from './gardenPets';

// The blocks page shows the pets under a "Ljubimci" heading, so searching that
// visible label has to keep the whole group discoverable instead of hiding it.
const gardenPetCategoryTerms = [
    'ljubimci',
    'ljubimac',
    'kucni ljubimci',
    'zivotinje',
];

export function gardenPetMatchesSearch(
    pet: GardenPet,
    normalizedSearch: string,
) {
    if (!normalizedSearch) {
        return true;
    }

    return [pet.name, ...pet.searchTerms, ...gardenPetCategoryTerms].some(
        (term) => normalizeSearchText(term).includes(normalizedSearch),
    );
}
