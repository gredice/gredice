import type { Route } from 'next';

export type SearchCategoryValue =
    | 'all'
    | 'plants'
    | 'sorts'
    | 'operations'
    | 'diseases'
    | 'pests'
    | 'blocks'
    | 'seeds';

export const searchCategories: {
    value: SearchCategoryValue;
    label: string;
}[] = [
    { value: 'all', label: 'Sve' },
    { value: 'plants', label: 'Biljke' },
    { value: 'sorts', label: 'Sorte' },
    { value: 'operations', label: 'Radnje' },
    { value: 'diseases', label: 'Bolesti' },
    { value: 'pests', label: 'Štetnici' },
    { value: 'blocks', label: 'Blokovi' },
    { value: 'seeds', label: 'Sjeme' },
];

export const navSearchLimit = 8;
export const searchPageLimit = 10;

export function searchCategoryParam(category: SearchCategoryValue) {
    return category === 'all' ? undefined : category;
}

export function normalizeSearchCategory(
    value: string | string[] | undefined,
): SearchCategoryValue {
    const category = Array.isArray(value) ? value[0] : value;
    return searchCategories.some((option) => option.value === category)
        ? (category as SearchCategoryValue)
        : 'all';
}

export function searchPageHref({
    query,
    category,
    page,
}: {
    query: string;
    category: SearchCategoryValue;
    page?: number;
}) {
    const params = new URLSearchParams();
    const trimmedQuery = query.trim();

    if (trimmedQuery) {
        params.set('pretraga', trimmedQuery);
    }
    const categoryParam = searchCategoryParam(category);
    if (categoryParam) {
        params.set('kategorija', categoryParam);
    }
    if (page && page > 1) {
        params.set('stranica', String(page));
    }

    const search = params.toString();
    return (search ? `/pretraga?${search}` : '/pretraga') as Route;
}
