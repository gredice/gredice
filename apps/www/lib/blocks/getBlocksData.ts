import { cache } from 'react';
import { getDirectoryEntitiesData } from '../server/getDirectoryEntitiesData';

export const getBlocksData = cache(() => getDirectoryEntitiesData('block'));
