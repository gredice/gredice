import { harvestWheelbarrow } from '@gredice/js/harvestWheelbarrow';
import { upsertDraftBlockEntities } from './lib/upsertDraftBlockEntities';

await upsertDraftBlockEntities([harvestWheelbarrow]);
