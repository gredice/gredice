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

export const deliveryChargeAtCheckoutFlag = flag(
    hypertuneAdapter.declarations.deliveryChargeAtCheckout,
);
export const addressDistanceVerificationFlag = flag(
    hypertuneAdapter.declarations.addressDistanceVerification,
);
export const raisedBedImageAIFlag = flag(
    hypertuneAdapter.declarations.raisedBedImageAI,
);
export const lsystemPlantsFlag = flag(
    hypertuneAdapter.declarations.lsystemPlants,
);
export const enableDebugCloseupFlag = flag(
    hypertuneAdapter.declarations.enableDebugCloseup,
);
export const enableDebugHudFlag = flag(
    hypertuneAdapter.declarations.enableDebugHud,
);
