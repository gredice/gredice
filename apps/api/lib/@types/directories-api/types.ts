import type { paths } from './v1';

export type BlockData =
    paths['/entities/block']['get']['responses']['200']['content']['application/json'][0];
