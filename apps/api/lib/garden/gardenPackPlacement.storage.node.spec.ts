import { registerGardenPackIntegrationSuite } from './gardenPackIntegrationHarness';

registerGardenPackIntegrationSuite(
    'garden pack placement repository/service integration suite',
    new URL('./gardenPackPlacement.integration.ts', import.meta.url),
);
