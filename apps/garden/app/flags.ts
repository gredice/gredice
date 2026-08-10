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

export const enableOutletGardenFlag = flag<boolean>({
    key: 'enableOutletGarden',
    description:
        'Expose the read-only 3D Outlet garden validation route from the current Outlet flow.',
    decide: () =>
        process.env.NODE_ENV === 'development' ||
        process.env.VERCEL_ENV === 'preview',
    options: booleanFlagOptions,
});
