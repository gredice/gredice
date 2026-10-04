import { registerGardenPackIntegrationSuite } from './gardenPackIntegrationHarness';

registerGardenPackIntegrationSuite(
    'private finite autumn cosmetic activity integration',
    new URL('./autumnActivity.integration.ts', import.meta.url),
);
