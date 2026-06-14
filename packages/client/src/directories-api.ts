import type { paths } from '@gredice/directory-types';
import createClient from 'openapi-fetch';
import { createDevSafeFetch, getAppUrl } from './shared';

const blockDirectoryCacheVersion =
    'summer-blocks-2026-06-14-umbrella-scale-colors-7';
const blockDirectoryPath = '/api/directories/entities/block';

function withBlockDirectoryCacheVersion(baseFetch: typeof fetch): typeof fetch {
    return (input, init) => {
        return baseFetch(versionBlockDirectoryRequest(input), init);
    };
}

function versionBlockDirectoryRequest(input: Parameters<typeof fetch>[0]) {
    if (typeof input === 'string') {
        return versionBlockDirectoryUrl(input);
    }

    if (input instanceof URL) {
        return new URL(versionBlockDirectoryUrl(input.toString()));
    }

    if (input instanceof Request) {
        const nextUrl = versionBlockDirectoryUrl(input.url);
        if (nextUrl === input.url) {
            return input;
        }

        return new Request(nextUrl, input);
    }

    return input;
}

function versionBlockDirectoryUrl(input: string) {
    const isRelative = input.startsWith('/');
    const url = isRelative
        ? new URL(input, 'https://gredice.local')
        : new URL(input);
    if (!url.pathname.endsWith(blockDirectoryPath)) {
        return input;
    }

    url.searchParams.set('v', blockDirectoryCacheVersion);
    return isRelative
        ? `${url.pathname}${url.search}${url.hash}`
        : url.toString();
}

// Re-export all directory types from @gredice/directory-types
export type {
    BlockData,
    BrandData,
    components,
    FaqCategoryData,
    FaqData,
    ImageData,
    OccasionData,
    OperationData,
    OperationFrequencyData,
    PlantData,
    PlantDiseaseData,
    PlantPestData,
    PlantSortData,
    PlantStageData,
    paths,
    SeedData,
} from '@gredice/directory-types';

export function directoriesClient() {
    const baseUrl = `${getAppUrl()}/api/directories`;

    return createClient<paths>({
        baseUrl,
        fetch: withBlockDirectoryCacheVersion(createDevSafeFetch()),
    });
}
