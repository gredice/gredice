import { woodlandArrangements } from '@gredice/js/woodlandArrangements';
import { upsertDraftBlockEntities } from './lib/upsertDraftBlockEntities';

await upsertDraftBlockEntities(woodlandArrangements);
