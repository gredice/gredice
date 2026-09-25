import { harvestPumpkins } from '@gredice/js/harvestPumpkins';
import { upsertDraftBlockEntities } from './lib/upsertDraftBlockEntities';

await upsertDraftBlockEntities(harvestPumpkins);
