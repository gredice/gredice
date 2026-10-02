import { halloweenAccents } from '@gredice/js/halloweenAccents';
import { upsertDraftBlockEntities } from './lib/upsertDraftBlockEntities';

await upsertDraftBlockEntities(halloweenAccents);
