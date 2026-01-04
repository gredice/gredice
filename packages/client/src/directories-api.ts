import type { paths } from '@gredice/directory-types';
import createClient from 'openapi-fetch';
import { createDevSafeFetch, getAppUrl } from './shared';

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
    PlantSortData,
    PlantStageData,
    paths,
    SeedData,
} from '@gredice/directory-types';

export function directoriesClient() {
    const baseUrl = `${getAppUrl()}/api/directories`;

    return createClient<paths>({
        baseUrl,
        fetch: createDevSafeFetch(),
    });
}
