import type { BlockData } from '@gredice/directory-types';
import { getEntitiesFormatted } from '@gredice/storage';

export async function getBlockData(): Promise<BlockData[]> {
    return (await getEntitiesFormatted<BlockData>('block')) ?? [];
}
