import { getEntitiesFormatted } from '@gredice/storage';
import type { BlockData } from '../@types/directories-api/types';

export async function getBlockData() {
    return (await getEntitiesFormatted('block')) as unknown as BlockData[];
}
