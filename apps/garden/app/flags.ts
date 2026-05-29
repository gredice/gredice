import { isWeatherHistoryUiEnabled } from '@gredice/js/featureFlags';
import { flag } from 'flags/next';

const booleanOptions = [
    { label: 'Off', value: false },
    { label: 'On', value: true },
];

export const deliveryChargeAtCheckoutFlag = flag<boolean>({
    key: 'deliveryChargeAtCheckout',
    description:
        'Whether to enable charging the delivery while doing checkout.',
    decide: () => false,
    options: booleanOptions,
});

export const addressDistanceVerificationFlag = flag<boolean>({
    key: 'addressDistanceVerification',
    description:
        'Enable address verification and indicator that the address is outside of delivery location.',
    decide: () => false,
    options: booleanOptions,
});

export const raisedBedImageAIFlag = flag<boolean>({
    key: 'raisedBedImageAI',
    description: 'Enable AI analysis of raised-bed images.',
    decide: () => true,
    options: booleanOptions,
});

export const lsystemPlantsFlag = flag<boolean>({
    key: 'lsystemPlants',
    description: 'Display L-System plants instead of only seeds.',
    decide: () => true,
    options: booleanOptions,
});

export const rainWetOverlayFlag = flag<boolean>({
    key: 'rainWetOverlay',
    description: 'Enable rain wetness overlays on exposed garden entities.',
    decide: () => false,
    options: booleanOptions,
});

export const enableDebugCloseupFlag = flag<boolean>({
    key: 'enableDebugCloseup',
    decide: () => false,
    options: booleanOptions,
});

export const enableDebugHudFlag = flag<boolean>({
    key: 'enableDebugHud',
    decide: () => false,
    options: booleanOptions,
});

export const plantHistoryFlag = flag<boolean>({
    key: 'plantHistory',
    description: 'Show previous plant history on inactive raised-bed fields.',
    decide: () => true,
    options: booleanOptions,
});

export const weatherHistoryUiFlag = flag<boolean>({
    key: 'weatherHistoryUi',
    description:
        'Enable weather history and forecast charts in the weather HUD. Enabled by default from the rollout date.',
    decide: () => isWeatherHistoryUiEnabled(),
    options: booleanOptions,
});
