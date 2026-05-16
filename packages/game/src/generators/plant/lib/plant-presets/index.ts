import type { PlantDefinition } from '../plant-definition-types';
import { alliumPlants } from './alliums';
import { aromaticPlants } from './aromatics';
import { berryPlants } from './berries';
import { brassicaPlants } from './brassicas';
import { cucurbitPlants } from './cucurbits';
import { fruitingPlants } from './fruiting';
import { grassPlants } from './grasses';
import { herbPlants } from './herbs';
import { leafyPlants } from './leafy';
import { legumePlants } from './legumes';
import { rootPlants } from './roots';
import { treePlants } from './trees';

export const plantTypes = {
    ...berryPlants,
    ...fruitingPlants,
    ...cucurbitPlants,
    ...rootPlants,
    ...alliumPlants,
    ...leafyPlants,
    ...herbPlants,
    ...legumePlants,
    ...brassicaPlants,
    ...aromaticPlants,
    ...grassPlants,
    ...treePlants,
} satisfies Record<string, PlantDefinition>;

export const plantTypeNames = Object.keys(plantTypes);
