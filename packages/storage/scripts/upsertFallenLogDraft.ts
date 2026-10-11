import { fallenLog } from '@gredice/js/fallenLog';
import { upsertDraftBlockEntities } from './lib/upsertDraftBlockEntities';

await upsertDraftBlockEntities([fallenLog]);
