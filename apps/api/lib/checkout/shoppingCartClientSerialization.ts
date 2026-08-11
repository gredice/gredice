import {
    type AdvancedSowingCartAuthorizationV1,
    buildAdvancedSowingSelectionSummaryV1,
} from '@gredice/js/plants';
import type { ShoppingCartItemWithShopData } from './cartInfo';

/**
 * Explicit client boundary. The authorization table is intentionally not
 * joined, and this omission keeps a future accidental join/spread from
 * exposing the server-owned checkout envelope.
 */
export function serializeShoppingCartItemForClient(
    {
        advancedSowingAuthorization: _advancedSowingAuthorization,
        ...item
    }: ShoppingCartItemWithShopData & {
        advancedSowingAuthorization?: unknown;
    },
    advancedSowingAuthorization?: AdvancedSowingCartAuthorizationV1,
) {
    return {
        ...item,
        ...(advancedSowingAuthorization
            ? {
                  advancedSowingSelection:
                      buildAdvancedSowingSelectionSummaryV1(
                          advancedSowingAuthorization,
                      ),
              }
            : {}),
    };
}
