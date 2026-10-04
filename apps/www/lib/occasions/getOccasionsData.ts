import { cache } from 'react';
import { getDirectoryEntitiesData } from '../server/getDirectoryEntitiesData';

export const getOccasionsData = cache(() =>
    getDirectoryEntitiesData('occasions'),
);
