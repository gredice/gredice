import {
    createSource,
    vercelFlagDefinitions as flagDefinitions,
    flagFallbacks,
    type FlagValues,
    type Context,
} from '../lib/flags/generated/hypertune'
import { flag } from 'flags/next'
import { createHypertuneAdapter } from '@flags-sdk/hypertune'
import { identify } from '../lib/flags/identify';

const hypertuneAdapter = createHypertuneAdapter<FlagValues, Context>({
    createSource,
    flagDefinitions,
    flagFallbacks,
    identify,
});

export const enableDebugHudFlag = flag(hypertuneAdapter.declarations.enableDebugHud);