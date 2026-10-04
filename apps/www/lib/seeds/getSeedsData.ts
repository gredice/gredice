import { cache } from 'react';
import { getDirectoryEntitiesData } from '../server/getDirectoryEntitiesData';

export const getSeedsData = cache(() => getDirectoryEntitiesData('seed'));
