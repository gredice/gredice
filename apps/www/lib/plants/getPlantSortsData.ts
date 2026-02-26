import { directoriesClient, type PlantSortData } from '@gredice/client';
import { unstable_cache } from 'next/cache';

export type { PlantSortData };

export const getPlantSortsData = unstable_cache(
    async () => {
        try {
            const { data, error } = await directoriesClient().GET(
                '/entities/plantSort',
            );

            if (error) {
                console.error('Failed to fetch plant sorts data', error);
                return [];
            }

            return data ?? [];
        } catch (error) {
            console.error('Failed to fetch plant sorts data', error);
            return [];
        }
    },
    ['plantSortsData'],
    {
        revalidate: 60 * 60, // 1 hour
        tags: ['plantSortsData'],
    },
);
