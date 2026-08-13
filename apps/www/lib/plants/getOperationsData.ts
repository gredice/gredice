import { cache } from 'react';
import { getDirectoryEntitiesData } from '../server/getDirectoryEntitiesData';

export const getOperationsData = cache(() =>
    getDirectoryEntitiesData('operation'),
);
