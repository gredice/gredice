import { getProviderData as getVercelProviderData } from '@flags-sdk/vercel';
import { mergeProviderData } from 'flags';
import { createFlagsDiscoveryEndpoint, getProviderData } from 'flags/next';
import * as flags from '../../../../app/flags';

export const GET = createFlagsDiscoveryEndpoint(() =>
    mergeProviderData([getProviderData(flags), getVercelProviderData(flags)]),
);
