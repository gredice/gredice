import { gardenTeaTable } from '@gredice/js/gardenTeaTable';
import { upsertDraftBlockEntities } from './lib/upsertDraftBlockEntities';

await upsertDraftBlockEntities([gardenTeaTable]);
