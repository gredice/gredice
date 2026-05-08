import type { NavContextType } from './NavContext';

type DirectoryEntityType =
    NavContextType['categorizedTypes'][number]['entityTypes'][number];

export type DirectoryBreadcrumbGroup = {
    key: string;
    label: string;
    icon?: string | null;
    entityTypes: DirectoryEntityType[];
};

export function getDirectoryBreadcrumbGroups(
    navContext: NavContextType | undefined,
) {
    const groups: DirectoryBreadcrumbGroup[] =
        navContext?.categorizedTypes.map((category) => ({
            key: `category-${category.id}`,
            label: category.label,
            icon: category.icon,
            entityTypes: category.entityTypes,
        })) ?? [];

    if (navContext?.uncategorizedTypes.length) {
        groups.push({
            key: 'uncategorized',
            label: 'Nekategorizirano',
            entityTypes: navContext.uncategorizedTypes,
        });
    }

    if (navContext?.shadowTypes.length) {
        groups.push({
            key: 'shadow',
            label: 'Ostalo',
            entityTypes: navContext.shadowTypes,
        });
    }

    return groups;
}

export function findDirectoryBreadcrumbGroup(
    groups: DirectoryBreadcrumbGroup[],
    entityTypeName: string,
) {
    return groups.find((group) =>
        group.entityTypes.some(
            (entityType) => entityType.name === entityTypeName,
        ),
    );
}

export function findDirectoryBreadcrumbEntityType(
    groups: DirectoryBreadcrumbGroup[],
    entityTypeName: string,
) {
    return groups
        .flatMap((group) => group.entityTypes)
        .find((entityType) => entityType.name === entityTypeName);
}
