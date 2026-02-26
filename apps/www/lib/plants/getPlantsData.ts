import { directoriesClient } from '@gredice/client';
import { unstable_cache } from 'next/cache';
import { isPlantRecommended } from '../../../../packages/js/src/plants/isPlantRecommended';

export const getPlantsData = unstable_cache(
    async () => {
        try {
            const { data, error } = await directoriesClient().GET(
                '/entities/plant',
            );

            if (error) {
                console.error('Failed to fetch plants data', error);
                return [];
            }

            return (
                data?.map((plant) => ({
                    ...plant,
                    isRecommended: isPlantRecommended(plant),
                })) ?? []
            );
        } catch (error) {
            console.error('Failed to fetch plants data', error);
            return [];
        }
    },
    ['plantsData'],
    {
        revalidate: 60 * 60, // 1 hour
        tags: ['plantsData'],
    },
);
