import { cache } from 'react';
import { getDirectoryEntitiesData } from './server/getDirectoryEntitiesData';

export const getHqLocationsData = cache(() =>
    getDirectoryEntitiesData('hqLocations'),
);
