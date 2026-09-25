import { harvestCrates } from '@gredice/js/harvestCrates';
import { upsertDraftBlockEntities } from './lib/upsertDraftBlockEntities';

await upsertDraftBlockEntities(harvestCrates);
