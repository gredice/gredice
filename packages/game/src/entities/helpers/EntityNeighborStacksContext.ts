import { createContext } from 'react';
import type { GardenStack } from '../../types/Stack';

/**
 * The stacks an entity reads its neighbours from instead of the current
 * garden's (`useEntityNeighbors`, `useFenceConnectionState`). A preview
 * that draws a block as it will look once placed, such as an Expand ghost,
 * passes the garden as it will be then, so a fence copy joins the fences
 * and copies beside it. `null` reads the garden.
 */
export const EntityNeighborStacksContext = createContext<GardenStack[] | null>(
    null,
);
