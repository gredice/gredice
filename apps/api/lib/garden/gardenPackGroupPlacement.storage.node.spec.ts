import { registerGardenPackIntegrationSuite } from './gardenPackIntegrationHarness';

registerGardenPackIntegrationSuite(
    'atomic owned pack group placement integration',
    new URL('./gardenPackGroupPlacement.integration.ts', import.meta.url),
);
