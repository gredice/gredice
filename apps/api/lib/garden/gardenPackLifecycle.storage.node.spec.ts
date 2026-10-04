import { registerGardenPackIntegrationSuite } from './gardenPackIntegrationHarness';

registerGardenPackIntegrationSuite(
    'garden pack lifecycle repository/service integration suite',
    new URL('./gardenPackLifecycle.integration.ts', import.meta.url),
);
