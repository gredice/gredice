import type { BlockData } from '@gredice/directory-types';
import {
    AccountDeletionInProgressError,
    AccountNotFoundError,
    GardenPackConflictError,
    type GardenPackTransaction,
    getGardenPackPurchaseByOperation,
    InsufficientSunflowersError,
    recordPurchasedGardenPack,
    spendSunflowersBatch,
    withAccountDeletionFenceTransaction,
    withSunflowerAccountTransaction,
} from '@gredice/storage';
import {
    type GardenPackProductSnapshot,
    gardenPackProductSnapshotSchema,
    isGardenPackAvailableForPurchase,
} from '@gredice/storage/gardenPackContract';
import { getBlockData } from '../blocks/blockDataService';
import { settleGardenEconomicMutationDependency } from './gardenEconomicMutationDependency';
import {
    type GardenPackOffer,
    getGardenPackCatalogue,
} from './gardenPackCatalogue';
import { assertGardenPackPurchaseContents } from './gardenPackEligibility';
import {
    type GardenPackPurchaseBody,
    type GardenPackPurchaseReceipt,
    gardenPackPurchaseBodySchema,
    gardenPackPurchaseReceiptSchema,
} from './gardenPackPurchaseSchemas';
import {
    getGardenPackStorageReadiness,
    isGardenPackSalesEnabled,
    isGardenPackStorageEnabled,
} from './gardenPackRollout';

export type GardenPackPurchaseDependencies<Transaction> = {
    isStorageEnabled: () => boolean;
    isSalesEnabled: () => boolean;
    isStorageReady: () => Promise<boolean>;
    withAccountTransaction: <T>(
        accountId: string,
        callback: (transaction: Transaction) => Promise<T>,
    ) => Promise<T>;
    readCompletedPurchase: (
        accountId: string,
        operationId: string,
    ) => Promise<Awaited<ReturnType<typeof getGardenPackPurchaseByOperation>>>;
    readPurchase: (
        accountId: string,
        operationId: string,
        transaction: Transaction,
    ) => Promise<Awaited<ReturnType<typeof getGardenPackPurchaseByOperation>>>;
    grant: (
        accountId: string,
        operationId: string,
        snapshot: GardenPackProductSnapshot,
        transaction: Transaction,
    ) => Promise<{ purchaseId: string; replayed: boolean }>;
    debit: (
        accountId: string,
        amount: number,
        reason: string,
        transaction: Transaction,
    ) => Promise<unknown>;
    getCatalogue: () => Promise<readonly GardenPackOffer[]>;
    getBlocks: () => Promise<readonly BlockData[]>;
    now: () => Date;
    dependencyPreparationTimeoutMs?: number;
};
export type GardenPackPurchaseResult =
    | { ok: true; receipt: GardenPackPurchaseReceipt; replayed: boolean }
    | { ok: false; code: string; error: string; status: 400 | 404 | 409 | 503 };
class PurchaseFailure extends Error {
    constructor(
        readonly code: string,
        readonly status: 400 | 404 | 409 | 503,
        message: string,
    ) {
        super(message);
    }
}
function fail(
    code: string,
    status: 400 | 404 | 409 | 503,
    message: string,
): never {
    throw new PurchaseFailure(code, status, message);
}

function receiptFrom(
    purchase: NonNullable<
        Awaited<ReturnType<typeof getGardenPackPurchaseByOperation>>
    >,
    command: GardenPackPurchaseBody,
) {
    const snapshot = purchase.snapshot;
    if (
        snapshot.productId !== command.productId ||
        snapshot.productVersionId !== command.quote.productVersionId ||
        snapshot.chargedSunflowers !== command.quote.chargedSunflowers ||
        snapshot.currency !== command.quote.currency
    )
        fail(
            'OPERATION_CONFLICT',
            409,
            'Isti zahtjev već je upotrijebljen za drukčiju kupnju.',
        );
    // Complete stable request/response receipt is derivable from immutable grant.
    return gardenPackPurchaseReceiptSchema.parse({
        purchaseId: purchase.id,
        productId: snapshot.productId,
        productVersionId: snapshot.productVersionId,
        chargedSunflowers: snapshot.chargedSunflowers,
        currency: snapshot.currency,
        purchasedAt: purchase.createdAt.toISOString(),
        totalQuantity: snapshot.lines.reduce(
            (sum, line) => sum + line.quantity,
            0,
        ),
    });
}

export function createGardenPackPurchaseService<Transaction>(
    dependencies: GardenPackPurchaseDependencies<Transaction>,
) {
    return async function purchaseGardenPack(
        accountId: string,
        input: GardenPackPurchaseBody,
    ): Promise<GardenPackPurchaseResult> {
        try {
            const parsed = gardenPackPurchaseBodySchema.safeParse(input);
            if (!parsed.success || !accountId || accountId.length > 128)
                fail(
                    'INVALID_PURCHASE',
                    400,
                    'Neispravan zahtjev za kupnju paketa.',
                );
            const command = parsed.data;
            // Must return before any pack query when the migration has not rolled out.
            if (!dependencies.isStorageEnabled())
                fail('PACKS_DISABLED', 503, 'Paketi trenutačno nisu dostupni.');
            if (!(await dependencies.isStorageReady()))
                fail(
                    'PACK_STORAGE_NOT_READY',
                    503,
                    'Paketi trenutačno nisu dostupni.',
                );
            // Shared catalogue readers may acquire their own pool connection. Prepare
            // before economic locks; recheck receipt under the lock even on timeout.
            const preexisting = await dependencies.readCompletedPurchase(
                accountId,
                command.operationId,
            );
            const prepared =
                !preexisting && dependencies.isSalesEnabled()
                    ? await settleGardenEconomicMutationDependency(async () => {
                          const [offers, blocks] = await Promise.all([
                              dependencies.getCatalogue(),
                              dependencies.getBlocks(),
                          ]);
                          return { offers, blocks };
                      }, dependencies.dependencyPreparationTimeoutMs)
                    : undefined;
            return await dependencies.withAccountTransaction(
                accountId,
                async (transaction) => {
                    const existing = await dependencies.readPurchase(
                        accountId,
                        command.operationId,
                        transaction,
                    );
                    if (existing)
                        return {
                            ok: true,
                            receipt: receiptFrom(existing, command),
                            replayed: true,
                        };
                    if (!dependencies.isSalesEnabled())
                        fail(
                            'PACK_SALES_DISABLED',
                            503,
                            'Prodaja paketa trenutačno nije dostupna.',
                        );
                    if (!prepared || prepared.status === 'rejected')
                        fail(
                            'PACK_CATALOGUE_UNAVAILABLE',
                            503,
                            'Ponudu paketa trenutačno nije moguće učitati.',
                        );
                    const offer = prepared.value.offers.find(
                        (entry) =>
                            entry.snapshot.productId === command.productId,
                    );
                    if (!offer)
                        fail('PACK_NOT_FOUND', 404, 'Paket nije pronađen.');
                    const snapshot = gardenPackProductSnapshotSchema.parse(
                        offer.snapshot,
                    );
                    const now = dependencies.now();
                    const time = now.getTime();
                    if (
                        !offer.sale.enabled ||
                        !isGardenPackAvailableForPurchase(snapshot, now) ||
                        (offer.sale.availableFrom !== null &&
                            time < Date.parse(offer.sale.availableFrom)) ||
                        (offer.sale.availableUntil !== null &&
                            time >= Date.parse(offer.sale.availableUntil))
                    )
                        fail(
                            'PACK_NOT_AVAILABLE',
                            409,
                            'Paket trenutačno nije dostupan za kupnju.',
                        );
                    if (
                        snapshot.productVersionId !==
                            command.quote.productVersionId ||
                        snapshot.chargedSunflowers !==
                            command.quote.chargedSunflowers ||
                        snapshot.currency !== command.quote.currency
                    )
                        fail(
                            'STALE_QUOTE',
                            409,
                            'Ponuda paketa promijenila se. Osvježi ponudu prije kupnje.',
                        );
                    try {
                        assertGardenPackPurchaseContents(
                            snapshot,
                            prepared.value.blocks,
                            now,
                        );
                    } catch {
                        fail(
                            'PACK_CONTENT_UNAVAILABLE',
                            409,
                            'Neki ukrasi iz paketa trenutačno nisu dostupni.',
                        );
                    }
                    await dependencies.debit(
                        accountId,
                        snapshot.chargedSunflowers,
                        `gardenPack:purchase:${command.operationId}`,
                        transaction,
                    );
                    await dependencies.grant(
                        accountId,
                        command.operationId,
                        snapshot,
                        transaction,
                    );
                    const purchase = await dependencies.readPurchase(
                        accountId,
                        command.operationId,
                        transaction,
                    );
                    if (!purchase)
                        throw new Error(
                            'Atomic garden pack grant receipt is missing',
                        );
                    return {
                        ok: true,
                        receipt: receiptFrom(purchase, command),
                        replayed: false,
                    };
                },
            );
        } catch (error) {
            if (error instanceof PurchaseFailure)
                return {
                    ok: false,
                    code: error.code,
                    error: error.message,
                    status: error.status,
                };
            if (error instanceof InsufficientSunflowersError)
                return {
                    ok: false,
                    code: 'INSUFFICIENT_SUNFLOWERS',
                    error: 'Nemaš dovoljno suncokreta za ovaj paket.',
                    status: 400,
                };
            if (error instanceof GardenPackConflictError)
                return {
                    ok: false,
                    code: 'OPERATION_CONFLICT',
                    error: 'Kupnja se sukobljava s postojećim zahtjevom ili inačicom paketa.',
                    status: 409,
                };
            if (error instanceof AccountDeletionInProgressError)
                return {
                    ok: false,
                    code: 'ACCOUNT_DELETION_IN_PROGRESS',
                    error: 'Račun se briše.',
                    status: 409,
                };
            if (error instanceof AccountNotFoundError)
                return {
                    ok: false,
                    code: 'ACCOUNT_NOT_FOUND',
                    error: 'Račun nije pronađen.',
                    status: 404,
                };
            console.error('Garden pack purchase failed atomically', {
                accountId,
                operationId: input.operationId,
                error,
            });
            return {
                ok: false,
                code: 'PACK_PURCHASE_FAILED',
                error: 'Kupnju paketa trenutačno nije moguće dovršiti.',
                status: 503,
            };
        }
    };
}

const defaultDependencies: GardenPackPurchaseDependencies<GardenPackTransaction> =
    {
        isStorageEnabled: isGardenPackStorageEnabled,
        isSalesEnabled: isGardenPackSalesEnabled,
        isStorageReady: getGardenPackStorageReadiness,
        withAccountTransaction: (accountId, callback) =>
            withSunflowerAccountTransaction(accountId, (tx) =>
                withAccountDeletionFenceTransaction(accountId, callback, tx),
            ),
        readCompletedPurchase: getGardenPackPurchaseByOperation,
        readPurchase: getGardenPackPurchaseByOperation,
        grant: recordPurchasedGardenPack,
        debit: (accountId, amount, reason, tx) =>
            spendSunflowersBatch(accountId, [{ amount, reason }], tx),
        getCatalogue: getGardenPackCatalogue,
        getBlocks: getBlockData,
        now: () => new Date(),
    };
export const purchaseGardenPackForAccount =
    createGardenPackPurchaseService(defaultDependencies);
