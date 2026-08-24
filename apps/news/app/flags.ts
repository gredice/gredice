import { booleanFlagOptions } from '@gredice/js/featureFlags';
import { flag } from 'flags/next';

export const enablePublicEnvironmentDebugFlag = flag<boolean>({
    key: 'enablePublicEnvironmentDebug',
    description:
        'Show time-of-day and weather overrides for the public ambient background.',
    decide: () => process.env.NODE_ENV === 'development',
    options: booleanFlagOptions,
});
