import { publicGardensFlagDefinition } from '@gredice/js/featureFlags';
import { flag } from 'flags/next';

export const publicGardensFlag = flag<boolean>({
    ...publicGardensFlagDefinition,
    decide: () => false,
});
