import { autumnEntrances } from '@gredice/js/autumnEntrances';
import { upsertDraftBlockEntities } from './lib/upsertDraftBlockEntities';

await upsertDraftBlockEntities(autumnEntrances);
