import { normalizeSearchText } from '../search/normalizeSearchText';
import type { GardenPet } from './gardenPets';

export function gardenPetMatchesSearch(
    pet: GardenPet,
    normalizedSearch: string,
) {
    if (!normalizedSearch) {
        return true;
    }

    return [pet.name, ...pet.searchTerms].some((term) =>
        normalizeSearchText(term).includes(normalizedSearch),
    );
}
