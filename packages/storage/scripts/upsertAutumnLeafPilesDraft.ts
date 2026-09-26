import { autumnLeafPiles } from '@gredice/js/autumnLeafPiles';
import { upsertDraftBlockEntities } from './lib/upsertDraftBlockEntities';

await upsertDraftBlockEntities(autumnLeafPiles);
