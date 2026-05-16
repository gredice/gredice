import { slugify } from '@gredice/js/slug';

export function toPageAlias(value: string): string {
    return slugify(value);
}

export function matchesPageAlias(
    entityLabel: string,
    alias: string | null,
): boolean {
    if (alias === null) {
        return false;
    }

    const normalizedAlias = alias.toLowerCase();

    return (
        entityLabel.toLowerCase() === normalizedAlias ||
        toPageAlias(entityLabel) === normalizedAlias
    );
}
