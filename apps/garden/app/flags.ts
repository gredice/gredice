import { createHypertuneAdapter } from '@flags-sdk/hypertune';
import { flag } from 'flags/next';
import {
    type Context,
    createSource,
    type FlagValues,
    vercelFlagDefinitions as flagDefinitions,
    flagFallbacks,
} from '../lib/flags/generated/hypertune';
import { identify } from '../lib/flags/identify';

const hypertuneAdapter = createHypertuneAdapter<FlagValues, Context>({
    createSource,
    flagDefinitions,
    flagFallbacks,
    identify,
});

export const enableDebugHudFlag = flag(
    hypertuneAdapter.declarations.enableDebugHud,
);
export const enableDebugCloseupFlag = flag(
    hypertuneAdapter.declarations.enableDebugCloseup,
);
export const enablePlantGeneratorFlag = flag(
    hypertuneAdapter.declarations.lsystemPlants,
);
