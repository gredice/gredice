import { directoriesClient } from '@gredice/client';
import { cache } from 'react';

export const getOperationsData = cache(async () => {
    try {
        const { data, error } = await directoriesClient().GET(
            '/entities/operation',
        );

        if (error) {
            console.error('Failed to fetch operations data', error);
            return [];
        }

        return data ?? [];
    } catch (error) {
        console.error('Failed to fetch operations data', error);
        return [];
    }
});
