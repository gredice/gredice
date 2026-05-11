import { directoriesClient } from '@gredice/client';
import { cache } from 'react';

export const getHqLocationsData = cache(async () => {
    try {
        const { data, error } = await directoriesClient().GET(
            '/entities/hqLocations',
        );

        if (error) {
            console.error('Failed to fetch HQ locations data', error);
            return [];
        }

        return data ?? [];
    } catch (error) {
        console.error('Failed to fetch HQ locations data', error);
        return [];
    }
});
