import 'server-only';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { storage } from '..';
import { priceListCsv } from '../helpers/priceListCsv';
import { events } from '../schema';
import { getPublicPriceCatalog } from './publicPriceCatalogRepo';

const type = 'pricing.catalog.published';
const aggregateId = 'public-service-price-list';
const snapshotSchema = z.object({
    csv: z.string(),
    day: z.string(),
    observedAt: z.string().optional(),
});
const dayFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Zagreb',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
});

function toPriceList(row: { id: number; createdAt: Date; data: unknown }) {
    const snapshot = snapshotSchema.parse(row.data);
    const stamp = row.createdAt.toISOString().replaceAll(/[-:.]/g, '');
    return {
        id: row.id,
        createdAt: row.createdAt,
        filename: `web_Ulica-Julija-Knifera-3-Zagreb_GREDICE_${row.id}_${stamp}.csv`,
        csv: snapshot.csv,
    };
}

export async function publishPublicPriceList() {
    // Catalog readers use their own connections, so do not hold a transaction
    // while loading them. The observation timestamp rejects late stale writers.
    const observedAt = new Date();
    const csv = priceListCsv(await getPublicPriceCatalog());
    return storage().transaction(async (tx) => {
        await tx.execute(
            sql`select pg_advisory_xact_lock(hashtext(${aggregateId}))`,
        );
        const now = new Date();
        const day = dayFormatter.format(now);
        const [latest] = await tx
            .select()
            .from(events)
            .where(
                and(eq(events.type, type), eq(events.aggregateId, aggregateId)),
            )
            .orderBy(desc(events.id))
            .limit(1);
        if (latest) {
            const previous = snapshotSchema.parse(latest.data);
            if (
                new Date(previous.observedAt ?? latest.createdAt) > observedAt
            ) {
                return toPriceList(latest);
            }
            if (previous.csv === csv && previous.day === day)
                return toPriceList(latest);
        }
        const [saved] = await tx
            .insert(events)
            .values({
                type,
                aggregateId,
                version: 1,
                createdAt: now,
                data: { csv, day, observedAt: observedAt.toISOString() },
            })
            .returning();
        if (!saved) throw new Error('Price list was not saved');
        return toPriceList(saved);
    });
}

export async function getPublishedPriceLists(now = new Date()) {
    const rows = await storage()
        .select()
        .from(events)
        .where(
            and(
                eq(events.type, type),
                eq(events.aggregateId, aggregateId),
                gte(
                    events.createdAt,
                    new Date(now.getTime() - 30 * 86_400_000),
                ),
                lte(events.createdAt, now),
            ),
        )
        .orderBy(desc(events.id));
    return rows.map(toPriceList);
}

export async function getPublishedPriceList(id?: number) {
    const [row] = await storage()
        .select()
        .from(events)
        .where(
            and(
                eq(events.type, type),
                eq(events.aggregateId, aggregateId),
                id === undefined ? undefined : eq(events.id, id),
            ),
        )
        .orderBy(desc(events.id))
        .limit(1);
    return row ? toPriceList(row) : null;
}
