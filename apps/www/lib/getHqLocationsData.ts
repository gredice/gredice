import { directoriesClient } from '@gredice/client';
import { unstable_cache } from 'next/cache';

export const getHqLocationsData = unstable_cache(
    async () => {
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
    },
    ['hqLocationsData'],
    {
        revalidate: 60 * 60, // 1 hour
        tags: ['hqLocationsData'],
    },
);
