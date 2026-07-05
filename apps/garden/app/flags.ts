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

export const rainWetOverlayFlag = flag<boolean>({
    key: 'rainWetOverlay',
    description: 'Enable rain wetness overlays on exposed garden entities.',
    decide: () => false,
    options: booleanFlagOptions,
});

export const blockGeometryMergingFlag = flag<boolean>({
    key: 'blockGeometryMerging',
    description: 'Enable merged geometry chunks for stable terrain blocks.',
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

export const enableSuncokretChatFlag = flag<boolean>({
    key: 'enableSuncokretChat',
    description: 'Enable the in-game Suncokret AI chat HUD.',
    decide: () => false,
    options: booleanFlagOptions,
});

export const enableSuncokretDebugFlag = flag<boolean>({
    key: 'enableSuncokretDebug',
    description: 'Show Suncokret AI debug metadata in chat conversations.',
    decide: () => false,
    options: booleanFlagOptions,
});
