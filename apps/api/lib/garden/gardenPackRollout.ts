import 'server-only';
import { isGardenPackStorageReady } from '@gredice/storage';

/** Storage readiness rollout only; withdrawing SALES must not disable ownership. */
export function isGardenPackStorageEnabled() {
    return process.env.GREDICE_GARDEN_PACKS_ENABLED === 'true';
}
export const getGardenPackStorageReadiness = isGardenPackStorageReady;
