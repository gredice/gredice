import { registerGardenPackIntegrationSuite } from './gardenPackIntegrationHarness';

registerGardenPackIntegrationSuite(
    'prepared autumn pack real repository/service pipeline',
    new URL('./autumnStarterPack.integration.ts', import.meta.url),
);
