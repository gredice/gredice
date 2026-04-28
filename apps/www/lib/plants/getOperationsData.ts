import { directoriesClient } from '@gredice/client';

export async function getOperationsData() {
    'use cache';

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
}
