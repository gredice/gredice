import { toPublicPageAlias } from '@gredice/directory-types';

export function toPageAlias(value: string): string {
    return toPublicPageAlias(value);
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
