// Existing API CI supplies shared contract/tsx dependencies; preserve pinned workflow bytes.
import '../../../../scripts/autumn-publication-plan.node.spec';
import { registerGardenPackIntegrationSuite } from './gardenPackIntegrationHarness';

registerGardenPackIntegrationSuite(
    'isolated atomic autumn catalogue publication',
    new URL('./autumnPublication.integration.ts', import.meta.url),
);
