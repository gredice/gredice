import { vercelAdapter } from '@flags-sdk/vercel';
import { booleanFlagOptions } from '@gredice/js/featureFlags';
import { flag } from 'flags/next';
import { outletGardenEnabledByDefault } from './outletGardenFlagDefault';

export const deliveryChargeAtCheckoutFlag = flag<boolean>({
    key: 'deliveryChargeAtCheckout',
    description:
        'Whether to enable charging the delivery while doing checkout.',
    decide: () => false,
    options: booleanFlagOptions,
});

export const addressDistanceVerificationFlag = flag<boolean>({
    key: 'addressDistanceVerification',
    description:
        'Enable address verification and indicator that the address is outside of delivery location.',
    decide: () => false,
    options: booleanFlagOptions,
});

export const enableDebugCloseupFlag = flag<boolean>({
    key: 'enableDebugCloseup',
    decide: () => false,
    options: booleanFlagOptions,
});

export const enableDebugHudFlag = flag<boolean>({
    key: 'enableDebugHud',
    decide: () => false,
    options: booleanFlagOptions,
});

export const enableSuncokretDebugFlag = flag<boolean>({
    key: 'enableSuncokretDebug',
    description: 'Show Suncokret AI debug metadata in chat conversations.',
    decide: () => false,
    options: booleanFlagOptions,
});

export const enableGardenAvatarFlag = flag<boolean>({
    key: 'enableGardenAvatar',
    description:
        'Enable the experimental walkable gardener with POV and third-person cameras.',
    decide: () => false,
    options: booleanFlagOptions,
});

export const enableOutletGardenFlag = flag<boolean>({
    key: 'enableOutletGarden',
    description:
        'Expose the 3D Outlet garden from the current Outlet flow; disabling restores the classic Outlet flow.',
    adapter: vercelAdapter,
    defaultValue: outletGardenEnabledByDefault(process.env),
    options: booleanFlagOptions,
});

export const enableAdvancedSowingFlag = flag<boolean>({
    key: 'enableAdvancedSowing',
    description:
        'Enable Advanced Sowing selection and cart submission for the internal Garden cohort; server authorization remains independently gated.',
    decide: () => false,
    options: booleanFlagOptions,
});

export const enableRaisedBedNotificationBubblesFlag = flag<boolean>({
    key: 'enableRaisedBedNotificationBubbles',
    description:
        'Show prioritized notification bubbles above raised beds in Garden.',
    decide: () => false,
    options: booleanFlagOptions,
});
