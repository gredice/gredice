import { and, eq, ne } from 'drizzle-orm';
import {
    closeStorage,
    shoppingCartItems,
    shoppingCarts,
    storage,
} from '../src';
import {
    advancedSowingReservedCartAuditPasses,
    auditAdvancedSowingReservedCartAdditionalData,
} from './lib/advancedSowingReservedCartAudit';

async function run() {
    const openCartItems = await storage()
        .select({ additionalData: shoppingCartItems.additionalData })
        .from(shoppingCartItems)
        .innerJoin(
            shoppingCarts,
            eq(shoppingCarts.id, shoppingCartItems.cartId),
        )
        .where(
            and(
                eq(shoppingCartItems.isDeleted, false),
                ne(shoppingCartItems.status, 'paid'),
                eq(shoppingCarts.isDeleted, false),
                ne(shoppingCarts.status, 'paid'),
            ),
        );
    const audit = auditAdvancedSowingReservedCartAdditionalData(openCartItems);

    console.info(JSON.stringify(audit, null, 2));
    if (!advancedSowingReservedCartAuditPasses(audit)) {
        process.exitCode = 1;
    }
}

try {
    await run();
} finally {
    await closeStorage();
}
