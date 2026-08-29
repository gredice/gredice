import { vercelAdapter } from '@flags-sdk/vercel';
import { booleanFlagOptions } from '@gredice/js/featureFlags';
import { flag } from 'flags/next';

export const enableLandingFeaturedGardensFlag = flag<boolean>({
    key: 'enableLandingFeaturedGardens',
    description:
        'Replace the landing demo garden with an animated carousel of owned and featured public gardens.',
    adapter: vercelAdapter,
    defaultValue:
        process.env.NODE_ENV === 'development' ||
        (process.env.VERCEL_ENV === 'preview' &&
            process.env.CI !== 'true' &&
            process.env.CI !== '1'),
    options: booleanFlagOptions,
});

export const enablePublicEnvironmentDebugFlag = flag<boolean>({
    key: 'enablePublicEnvironmentDebug',
    description:
        'Show time-of-day and weather overrides for the public ambient background.',
    decide: () => process.env.NODE_ENV === 'development',
    options: booleanFlagOptions,
});
