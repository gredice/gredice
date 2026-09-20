import 'server-only';

import { getCmsPages, getPublicGardenSitemapSources } from '@gredice/storage';
import { resolveProceduralPlantType } from '../../app/blokovi/plantNamesWithProceduralModels';
import { plantHealthIssueTitle } from '../../components/plant-health/plantHealthIssueContent';
import { toPageAlias } from '../../src/pageAliases';
import { getBlockRouteAlias } from '../blocks/blockRoute';
import { getBlocksData } from '../blocks/getBlocksData';
import { getOccasionsData } from '../occasions/getOccasionsData';
import { getOperationsData } from '../plants/getOperationsData';
import {
    getPlantDiseasesData,
    getPlantPestsData,
} from '../plants/getPlantHealthIssuesData';
import { getPlantSortsData } from '../plants/getPlantSortsData';
import { getPlantsData } from '../plants/getPlantsData';
import { getSeedBrandsData } from '../seeds/getSeedBrandsData';
import { getSeedsData } from '../seeds/getSeedsData';
import {
    collectSitemapLastmodIndex,
    collectSitemapSourceEntries,
    type DirectorySitemapSource,
} from './sitemapSourcePaths';

type SluggedDirectoryEntity = {
    slug?: string | null;
    updatedAt?: string | null;
};

function directoryAlias(entity: SluggedDirectoryEntity, fallback: string) {
    return entity.slug || toPageAlias(fallback);
}

async function loadDirectoryLastmodSources(): Promise<
    DirectorySitemapSource[]
> {
    const [
        plants,
        plantSorts,
        blocks,
        operations,
        diseases,
        pests,
        seeds,
        brands,
        occasions,
    ] = await Promise.all([
        getPlantsData(),
        getPlantSortsData(),
        getBlocksData(),
        getOperationsData(),
        getPlantDiseasesData(),
        getPlantPestsData(),
        getSeedsData(),
        getSeedBrandsData(),
        getOccasionsData(),
    ]);

    const sources: DirectorySitemapSource[] = [];
    const plantsById = new Map(
        (plants ?? []).map((plant) => [plant.id, plant]),
    );

    for (const plant of plants ?? []) {
        const alias = directoryAlias(plant, plant.information.name);
        sources.push({
            path: `/biljke/${alias}`,
            updatedAt: plant.updatedAt,
        });

        if (resolveProceduralPlantType(plant.information.name) !== null) {
            sources.push({
                path: `/blokovi/biljke/${alias}`,
                updatedAt: plant.updatedAt,
            });
        }
    }

    for (const sort of plantSorts ?? []) {
        const plantId = sort.information?.plant?.id;
        const plant = plantId ? plantsById.get(plantId) : undefined;
        if (!plant || !sort.information?.name) {
            continue;
        }

        sources.push({
            path: `/biljke/${directoryAlias(plant, plant.information.name)}/sorte/${directoryAlias(sort, sort.information.name)}`,
            updatedAt: sort.updatedAt,
        });
    }

    for (const block of blocks ?? []) {
        sources.push({
            path: `/blokovi/${getBlockRouteAlias(block)}`,
            updatedAt: block.updatedAt,
        });
    }

    for (const operation of operations ?? []) {
        sources.push({
            path: `/radnje/${directoryAlias(operation, operation.information.label)}`,
            updatedAt: operation.updatedAt,
        });
    }

    for (const disease of diseases ?? []) {
        sources.push({
            path: `/bolesti/${directoryAlias(disease, plantHealthIssueTitle(disease))}`,
            updatedAt: disease.updatedAt,
        });
    }

    for (const pest of pests ?? []) {
        sources.push({
            path: `/stetnici/${directoryAlias(pest, plantHealthIssueTitle(pest))}`,
            updatedAt: pest.updatedAt,
        });
    }

    for (const seed of seeds ?? []) {
        sources.push({
            path: `/sjeme/${directoryAlias(seed, seed.information.name)}`,
            updatedAt: seed.updatedAt,
        });
    }

    for (const brand of brands ?? []) {
        sources.push({
            path: `/sjeme/brend/${directoryAlias(brand, brand.information.name)}`,
            updatedAt: brand.updatedAt,
        });
    }

    for (const occasion of occasions ?? []) {
        sources.push({
            path: `/legalno/natjecaji/${toPageAlias(occasion.information.name)}`,
            updatedAt: occasion.updatedAt,
        });
    }

    return sources;
}

/**
 * Sitemap entries that `next-sitemap` cannot discover from the build output:
 * dynamic public hubs, CMS pages and eligible public gardens.
 */
export async function getSitemapSourceEntries() {
    const [cmsPages, publicGardens] = await Promise.all([
        getCmsPages({ state: 'published' }),
        getPublicGardenSitemapSources(),
    ]);

    return collectSitemapSourceEntries({ cmsPages, publicGardens });
}

export async function getSitemapSourcePaths() {
    return (await getSitemapSourceEntries()).map((entry) => entry.path);
}

let lastmodIndexPromise: Promise<Map<string, string>> | null = null;

/**
 * `path -> lastmod` lookup for every sitemap URL. Built once per generator run
 * because `transform` is called for each discovered route.
 */
export function getSitemapLastmodIndex() {
    lastmodIndexPromise ??= (async () => {
        const [sourceEntries, directoryEntries] = await Promise.all([
            getSitemapSourceEntries(),
            loadDirectoryLastmodSources(),
        ]);

        return collectSitemapLastmodIndex({ sourceEntries, directoryEntries });
    })();

    return lastmodIndexPromise;
}
