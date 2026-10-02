import { pumpkinLanterns } from '@gredice/js/pumpkinLanterns';
import { upsertDraftBlockEntities } from './lib/upsertDraftBlockEntities';

await upsertDraftBlockEntities(pumpkinLanterns);
