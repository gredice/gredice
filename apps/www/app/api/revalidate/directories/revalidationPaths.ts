export type PublicDirectoryEntityType =
    | 'block'
    | 'brand'
    | 'plant'
    | 'plantDisease'
    | 'plantPest'
    | 'plantSort'
    | 'operation'
    | 'seed'
    | 'sunflowerPackage';

export type RevalidationPath = {
    path: string;
    type?: 'page' | 'layout';
};

const revalidationPathsByEntityType: Record<
    PublicDirectoryEntityType,
    RevalidationPath[]
> = {
    block: [
        { path: '/blokovi' },
        { path: '/blokovi/ljubimci' },
        { path: '/blokovi/[alias]', type: 'page' },
    ],
    brand: [
        { path: '/sjeme' },
        { path: '/sjeme/[slug]', type: 'page' },
        { path: '/sjeme/brendovi' },
        { path: '/sjeme/brend/[slug]', type: 'page' },
    ],
    plant: [
        { path: '/' },
        { path: '/biljke' },
        { path: '/biljke/[alias]', type: 'page' },
        { path: '/biljke/[alias]/sorte/[sortAlias]', type: 'page' },
        { path: '/blokovi' },
        { path: '/blokovi/biljke' },
        { path: '/blokovi/biljke/[alias]', type: 'page' },
        { path: '/radnje/[alias]', type: 'page' },
        { path: '/cjenik' },
        { path: '/sjeme' },
        { path: '/sjeme/[slug]', type: 'page' },
        { path: '/sjeme/brend/[slug]', type: 'page' },
    ],
    plantDisease: [
        { path: '/bolesti' },
        { path: '/bolesti/[alias]', type: 'page' },
        { path: '/biljke/[alias]', type: 'page' },
    ],
    plantPest: [
        { path: '/stetnici' },
        { path: '/stetnici/[alias]', type: 'page' },
        { path: '/biljke/[alias]', type: 'page' },
    ],
    plantSort: [
        { path: '/' },
        { path: '/biljke/[alias]', type: 'page' },
        { path: '/biljke/[alias]/sorte/[sortAlias]', type: 'page' },
        { path: '/blokovi/biljke/[alias]', type: 'page' },
        { path: '/sjeme' },
        { path: '/sjeme/[slug]', type: 'page' },
        { path: '/sjeme/brend/[slug]', type: 'page' },
    ],
    operation: [
        { path: '/radnje' },
        { path: '/radnje/[alias]', type: 'page' },
        { path: '/biljke/[alias]', type: 'page' },
        { path: '/sjetva' },
        { path: '/cjenik' },
    ],
    seed: [
        { path: '/sjeme' },
        { path: '/sjeme/[slug]', type: 'page' },
        { path: '/sjeme/brendovi' },
        { path: '/sjeme/brend/[slug]', type: 'page' },
        { path: '/biljke/[alias]/sorte/[sortAlias]', type: 'page' },
    ],
    sunflowerPackage: [{ path: '/suncokreti' }, { path: '/cjenik' }],
};

export function collectRevalidationPaths(
    entityTypes: PublicDirectoryEntityType[],
) {
    const paths: RevalidationPath[] = [];
    const pathKeys = new Set<string>();

    for (const entityType of entityTypes) {
        for (const revalidationPath of revalidationPathsByEntityType[
            entityType
        ]) {
            const key = `${revalidationPath.type ?? 'path'}:${revalidationPath.path}`;
            if (!pathKeys.has(key)) {
                pathKeys.add(key);
                paths.push(revalidationPath);
            }
        }
    }

    return paths;
}
