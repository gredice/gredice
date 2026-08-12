import { getProviderData } from '@flags-sdk/vercel';
import { createFlagsDiscoveryEndpoint } from 'flags/next';
import * as flags from '../../../../app/flags';

export const GET = createFlagsDiscoveryEndpoint(async () =>
    getProviderData(flags),
);
