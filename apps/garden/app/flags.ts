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
export const enableRaisedBedWateringFlag = flag(
    hypertuneAdapter.declarations.raisedBedWatering,
);
export const enableRaisedBedDiaryFlag = flag(
    hypertuneAdapter.declarations.raisedBedDiary,
);
export const enableRaisedBedOperationsFlag = flag(
    hypertuneAdapter.declarations.raisedBedOperations,
);
export const enableRaisedBedFieldOperationsFlag = flag(
    hypertuneAdapter.declarations.raisedBedFieldOperations,
);
export const enableRaisedBedFieldWateringFlag = flag(
    hypertuneAdapter.declarations.raisedBedFieldWatering,
);
export const enableRaisedBedFieldDiaryFlag = flag(
    hypertuneAdapter.declarations.raisedBedFieldDiary,
);
