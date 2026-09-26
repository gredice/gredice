import { seedDryingRack } from '@gredice/js/seedDryingRack';
import { upsertDraftBlockEntities } from './lib/upsertDraftBlockEntities';

await upsertDraftBlockEntities([seedDryingRack]);
