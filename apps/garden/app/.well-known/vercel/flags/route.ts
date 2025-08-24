import { createFlagsDiscoveryEndpoint, getProviderData } from 'flags/next';
import * as flags from '../../../../app/flags';

export const GET = createFlagsDiscoveryEndpoint(() => getProviderData(flags));
