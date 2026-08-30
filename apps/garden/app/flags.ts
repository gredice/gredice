import { vercelAdapter } from '@flags-sdk/vercel';
import { booleanFlagOptions } from '@gredice/js/featureFlags';
import { flag } from 'flags/next';

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

export const enableGardenBuildingSystemFlag = flag<boolean>({
    key: 'enableGardenBuildingSystem',
    description:
        'Enable discovery and editing for the mobile-first modular garden building system.',
    ...(process.env.FLAGS
        ? { adapter: vercelAdapter }
        : { decide: () => false }),
    defaultValue: false,
    options: booleanFlagOptions,
});
