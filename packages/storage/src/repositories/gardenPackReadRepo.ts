import 'server-only';
import {
    and,
    asc,
    eq,
    getTableColumns,
    gt,
    inArray,
    or,
    sql,
} from 'drizzle-orm';
import { z } from 'zod';
import { gardenPackProductSnapshotSchema } from '../gardenPackContract';
import { gardenPackPurchases, gardenPackUnits } from '../schema';
import { storage } from '../storage';
import type { GardenPackTransaction } from './gardenPacksRepo';

type Database = ReturnType<typeof storage> | GardenPackTransaction;
const ownerId = z.string().min(1).max(128);
const cursorSchema = z.object({
    purchasedAt: z.iso.datetime(),
    purchaseId: z.string().uuid(),
});
export const gardenPackInventoryQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().min(1).max(300).optional(),
});
export type GardenPackInventoryQuery = z.input<
    typeof gardenPackInventoryQuerySchema
>;

function decodeCursor(value: string) {
    return cursorSchema.parse(
        JSON.parse(Buffer.from(value, 'base64url').toString('utf8')),
    );
}

export async function isGardenPackStorageReady(database: Database = storage()) {
    // System-catalogue only: safe when none of the pack tables exist yet.
    const requiredTables = [
        'garden_pack_product_versions',
        'garden_pack_purchases',
        'garden_pack_units',
        'garden_pack_unit_events',
    ];
    const requiredTriggers = [
        'garden_pack_version_immutable',
        'garden_pack_purchase_immutable',
        'garden_pack_unit_immutable',
        'garden_pack_event_immutable',
        'garden_pack_purchase_contents',
        'garden_pack_unit_contents',
        'garden_pack_event_validate',
        'garden_pack_unit_state_audit',
        'garden_pack_event_state_audit',
    ];
    const result = await database.execute(sql`
        SELECT
          (SELECT count(*) = 4 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = current_schema() AND c.relname = ANY(${requiredTables}::text[]) AND c.relkind = 'r') AND
          (SELECT count(*) = 9 FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = current_schema() AND t.tgname = ANY(${requiredTriggers}::text[]) AND t.tgenabled IN ('O','A') AND NOT t.tgisinternal AND c.relname = ANY(${requiredTables}::text[]) AND (t.tgname NOT IN ('garden_pack_purchase_contents','garden_pack_unit_contents','garden_pack_unit_state_audit','garden_pack_event_state_audit') OR (t.tgdeferrable AND t.tginitdeferred))) AS ready
    `);
    const row = z
        .object({ rows: z.array(z.object({ ready: z.boolean() })) })
        .parse(result).rows[0];
    return (
        typeof row === 'object' &&
        row !== null &&
        'ready' in row &&
        row.ready === true
    );
}

export async function getGardenPackPurchaseByOperation(
    accountId: string,
    operationId: string,
    database: Database = storage(),
) {
    ownerId.parse(accountId);
    z.string().uuid().parse(operationId);
    const [purchase] = await database
        .select()
        .from(gardenPackPurchases)
        .where(
            and(
                eq(gardenPackPurchases.accountId, accountId),
                eq(gardenPackPurchases.operationId, operationId),
            ),
        )
        .limit(1);
    return purchase
        ? {
              ...purchase,
              snapshot: gardenPackProductSnapshotSchema.parse(
                  purchase.snapshot,
              ),
          }
        : undefined;
}

type Purchase = typeof gardenPackPurchases.$inferSelect;
type Unit = typeof gardenPackUnits.$inferSelect;
function projectInventory(purchase: Purchase, units: Unit[]) {
    const snapshot = gardenPackProductSnapshotSchema.parse(purchase.snapshot);
    const remainingQuantity = units.filter(
        (unit) => unit.state === 'available',
    ).length;
    const totalQuantity = snapshot.lines.reduce(
        (sum, line) => sum + line.quantity,
        0,
    );
    const state: 'unopened' | 'partially-used' | 'exhausted' =
        remainingQuantity === totalQuantity
            ? 'unopened'
            : remainingQuantity === 0
              ? 'exhausted'
              : 'partially-used';
    return {
        purchaseId: purchase.id,
        productId: snapshot.productId,
        productVersionId: snapshot.productVersionId,
        name: snapshot.name,
        description: snapshot.description,
        previews: snapshot.previews,
        purchasedAt: purchase.createdAt.toISOString(),
        totalQuantity,
        remainingQuantity,
        state,
        lines: snapshot.lines.map((line) => ({
            lineId: line.lineId,
            entityId: line.entityId,
            modelName: line.modelName,
            variant: line.variant,
            quantity: line.quantity,
            remainingQuantity: units.filter(
                (unit) =>
                    unit.lineId === line.lineId && unit.state === 'available',
            ).length,
            availableUnitOrdinals: units
                .filter(
                    (unit) =>
                        unit.lineId === line.lineId &&
                        unit.state === 'available',
                )
                .map((unit) => unit.unitOrdinal),
        })),
    };
}
export type GardenPackInventoryPurchase = ReturnType<typeof projectInventory>;

export async function getGardenPackInventoryPage(
    accountId: string,
    query: GardenPackInventoryQuery = {},
    database: Database = storage(),
) {
    ownerId.parse(accountId);
    const parsed = gardenPackInventoryQuerySchema.parse(query);
    const cursor = parsed.cursor ? decodeCursor(parsed.cursor) : undefined;
    const purchases = await database
        .select({
            ...getTableColumns(gardenPackPurchases),
            cursorTimestamp: sql<string>`to_char(${gardenPackPurchases.createdAt}, 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
        })
        .from(gardenPackPurchases)
        .where(
            and(
                eq(gardenPackPurchases.accountId, accountId),
                cursor
                    ? or(
                          sql`${gardenPackPurchases.createdAt} > ${cursor.purchasedAt}::timestamp`,
                          and(
                              sql`${gardenPackPurchases.createdAt} = ${cursor.purchasedAt}::timestamp`,
                              gt(gardenPackPurchases.id, cursor.purchaseId),
                          ),
                      )
                    : undefined,
            ),
        )
        .orderBy(
            asc(gardenPackPurchases.createdAt),
            asc(gardenPackPurchases.id),
        )
        .limit(parsed.limit + 1);
    const page = purchases.slice(0, parsed.limit);
    const units = page.length
        ? await database
              .select()
              .from(gardenPackUnits)
              .where(
                  inArray(
                      gardenPackUnits.purchaseId,
                      page.map((purchase) => purchase.id),
                  ),
              )
              .orderBy(
                  asc(gardenPackUnits.lineId),
                  asc(gardenPackUnits.unitOrdinal),
              )
        : [];
    const hasMore = purchases.length > parsed.limit;
    const last = page.at(-1);
    return {
        purchases: page.map((purchase) =>
            projectInventory(
                purchase,
                units.filter((unit) => unit.purchaseId === purchase.id),
            ),
        ),
        hasMore,
        nextCursor:
            hasMore && last
                ? Buffer.from(
                      JSON.stringify({
                          purchasedAt: last.cursorTimestamp,
                          purchaseId: last.id,
                      }),
                  ).toString('base64url')
                : null,
    };
}

export async function getGardenPackInventoryPurchase(
    accountId: string,
    purchaseId: string,
    database: Database = storage(),
) {
    ownerId.parse(accountId);
    z.string().uuid().parse(purchaseId);
    const [purchase] = await database
        .select()
        .from(gardenPackPurchases)
        .where(
            and(
                eq(gardenPackPurchases.accountId, accountId),
                eq(gardenPackPurchases.id, purchaseId),
            ),
        )
        .limit(1);
    if (!purchase) return undefined;
    const units = await database
        .select()
        .from(gardenPackUnits)
        .where(eq(gardenPackUnits.purchaseId, purchase.id))
        .orderBy(asc(gardenPackUnits.lineId), asc(gardenPackUnits.unitOrdinal));
    return projectInventory(purchase, units);
}
