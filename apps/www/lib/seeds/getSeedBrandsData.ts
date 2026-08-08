import { directoriesClient } from '@gredice/client';
import { cache } from 'react';

export const getSeedBrandsData = cache(async () => {
    try {
        const { data, error } =
            await directoriesClient().GET('/entities/brand');

        if (error) {
            console.error('Failed to fetch seed brands data', error);
            return [];
        }

        return data ?? [];
    } catch (error) {
        console.error('Failed to fetch seed brands data', error);
        return [];
    }
});
