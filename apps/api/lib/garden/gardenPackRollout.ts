import 'server-only';
import { isGardenPackStorageReady } from '@gredice/storage';

/** Storage readiness rollout only; withdrawing SALES must not disable ownership. */
export function isGardenPackStorageEnabled() {
    return process.env.GREDICE_GARDEN_PACKS_ENABLED === 'true';
}
/** New-sales kill switch; keeps owned reads and completed receipts available. */
export function isGardenPackSalesEnabled() {
    return process.env.GREDICE_GARDEN_PACK_SALES_ENABLED === 'true';
}
export const getGardenPackStorageReadiness = isGardenPackStorageReady;
