import { touchTemporaryUserActivity } from '@gredice/storage';

export async function touchTemporaryUserActivityBestEffort(
    userId: string,
    options?: {
        force?: boolean;
    },
) {
    try {
        await touchTemporaryUserActivity(userId, options);
    } catch (error) {
        console.warn('Unable to update temporary user activity', { error });
    }
}
