import { cache } from 'react';
import { getDirectoryEntitiesData } from '../server/getDirectoryEntitiesData';

export const getSeedBrandsData = cache(() => getDirectoryEntitiesData('brand'));
