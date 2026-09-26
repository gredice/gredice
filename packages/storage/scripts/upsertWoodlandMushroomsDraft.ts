import { woodlandMushrooms } from '@gredice/js/woodlandMushrooms';
import { upsertDraftBlockEntities } from './lib/upsertDraftBlockEntities';

await upsertDraftBlockEntities([woodlandMushrooms]);
