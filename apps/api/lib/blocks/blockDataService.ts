import { getEntitiesFormatted } from '@gredice/storage';
import type { BlockData } from '../@types/directories-api/types';

export async function getBlockData(): Promise<BlockData[]> {
    return (await getEntitiesFormatted<BlockData>('block')) ?? [];
}
