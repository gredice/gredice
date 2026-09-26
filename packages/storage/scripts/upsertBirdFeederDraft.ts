import { birdFeeder } from '@gredice/js/birdFeeder';
import { upsertDraftBlockEntities } from './lib/upsertDraftBlockEntities';

await upsertDraftBlockEntities([birdFeeder]);
